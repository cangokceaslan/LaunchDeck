import { useEffect, useRef, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { AppShell } from '@components/AppShell';
import { WindowFrame } from '@components/WindowFrame';
import { ApplicationDetail } from '@screens/ApplicationDetail';
import { ApplicationList } from '@screens/ApplicationList';
import { ApplicationSetup } from '@screens/ApplicationSetup';
import { Doctor } from '@screens/Doctor';
import { ReleasePipeline } from '@screens/ReleasePipeline';
import type { ReleasePipelineIntent } from '@screens/ReleasePipeline/index.types';
import { normalizeErrorMessage } from '@renderer/utils/formatting';
import type {
  ApplicationDetail as ApplicationDetailModel,
  ApplicationSummary,
  ReleasePlatform,
  ThemePreference,
} from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';
import type { FastAction, RunHistorySummary } from '@shared/contracts/release';
import styles from '@renderer/App.module.scss';

type View = 'home' | 'setup' | 'detail' | 'edit' | 'release';

export const App = (): React.JSX.Element => {
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [isCheckingDoctor, setIsCheckingDoctor] = useState(true);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [hasPassedDoctor, setHasPassedDoctor] = useState(false);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationDetailModel | null>(null);
  const [history, setHistory] = useState<RunHistorySummary[]>([]);
  const [fastActions, setFastActions] = useState<FastAction[]>([]);
  const [releaseIntent, setReleaseIntent] = useState<ReleasePipelineIntent | null>(null);
  const [startingFastActionId, setStartingFastActionId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [view, setView] = useState<View>('home');
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const refreshApplications = async (): Promise<ApplicationSummary[]> => {
    const nextApplications = await window.desktopApi.listApplications();
    setApplications(nextApplications);
    return nextApplications;
  };

  const enterApplication = async (): Promise<void> => {
    try {
      await refreshApplications();
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    } finally {
      setHasPassedDoctor(true);
    }
  };

  const runDoctor = async (): Promise<void> => {
    setDoctorError(null);
    setIsCheckingDoctor(true);
    try {
      const report = await window.desktopApi.runDoctor();
      setDoctorReport(report);
      const hasActionableWarning =
        report.os === 'darwin' &&
        report.checks.some((check) => check.code === 'xcode' && check.status === 'warning');
      if (report.isReady && !hasActionableWarning) {
        await enterApplication();
      }
    } catch (error) {
      setDoctorError(normalizeErrorMessage(error));
    } finally {
      setIsCheckingDoctor(false);
    }
  };

  const loadHistory = async (applicationId: string): Promise<void> => {
    setIsHistoryLoading(true);
    try {
      setHistory(await window.desktopApi.listRunHistory(applicationId));
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadFastActions = async (applicationId: string): Promise<void> => {
    setFastActions(await window.desktopApi.listFastActions(applicationId));
  };

  const openApplication = async (applicationId: string): Promise<void> => {
    setGlobalError(null);
    try {
      const application = await window.desktopApi.getApplication(applicationId);
      if (application === null) {
        setGlobalError('Application not found.');
        return;
      }
      setFastActions([]);
      setHistory([]);
      setSelectedApplication(application);
      setView('detail');
      await Promise.all([loadHistory(applicationId), loadFastActions(applicationId)]);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
  };

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    void runDoctor();
    void window.desktopApi
      .getSettings()
      .then((settings) => setTheme(settings.theme))
      .catch((error: unknown) => setGlobalError(normalizeErrorMessage(error)));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (): void => {
      const resolvedTheme = theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.bsTheme = resolvedTheme;
    };
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  const handleContinue = async (): Promise<void> => {
    await enterApplication();
  };

  const handleThemeChange = async (nextTheme: ThemePreference): Promise<void> => {
    setTheme(nextTheme);
    try {
      await window.desktopApi.updateTheme(nextTheme);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
  };

  const handleSaved = async (application: ApplicationDetailModel): Promise<void> => {
    setSelectedApplication(application);
    await refreshApplications();
    await Promise.all([loadHistory(application.id), loadFastActions(application.id)]);
    setView('detail');
  };

  const handleDelete = async (): Promise<void> => {
    if (selectedApplication === null) return;
    try {
      await window.desktopApi.deleteApplication(selectedApplication.id);
      setSelectedApplication(null);
      setHistory([]);
      setFastActions([]);
      setReleaseIntent(null);
      await refreshApplications();
      setView('home');
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
  };

  const handleClearHistory = async (): Promise<void> => {
    if (selectedApplication === null) return;
    try {
      await window.desktopApi.clearRunHistory(selectedApplication.id);
      await loadHistory(selectedApplication.id);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
  };

  const handleReleaseFinished = async (): Promise<void> => {
    if (selectedApplication === null) return;
    try {
      await loadHistory(selectedApplication.id);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
    setReleaseIntent(null);
    setView('detail');
  };

  const handleFastActionSaved = (fastAction: FastAction): void => {
    setFastActions((currentFastActions) => {
      const existingIndex = currentFastActions.findIndex((current) => current.id === fastAction.id);
      if (existingIndex === -1) return [...currentFastActions, fastAction];
      return currentFastActions.map((current) =>
        current.id === fastAction.id ? fastAction : current,
      );
    });
    setReleaseIntent(null);
    setView('detail');
  };

  const handleDeleteFastAction = async (fastActionId: string): Promise<void> => {
    if (selectedApplication === null) return;
    setGlobalError(null);
    try {
      const result = await window.desktopApi.deleteFastAction({
        applicationId: selectedApplication.id,
        id: fastActionId,
      });
      if (result.deleted) {
        setFastActions((currentFastActions) =>
          currentFastActions.filter((fastAction) => fastAction.id !== fastActionId),
        );
      }
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
  };

  const handleRunFastAction = async (fastAction: FastAction): Promise<void> => {
    if (selectedApplication === null) return;
    setGlobalError(null);
    setStartingFastActionId(fastAction.id);
    try {
      const preflight = await window.desktopApi.preflightRelease({
        ...fastAction.configuration,
        applicationId: selectedApplication.id,
      });
      setReleaseIntent({ fastAction, kind: 'runFastAction', preflight });
      setView('release');
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    } finally {
      setStartingFastActionId(null);
    }
  };

  if (
    !hasPassedDoctor &&
    isCheckingDoctor &&
    (doctorReport === null || doctorReport.isReady)
  ) {
    return (
      <WindowFrame>
        <div className={styles.startupLoading} role="status">
          <Spinner animation="border" size="sm" />
          <span>Preparing LaunchDeck…</span>
        </div>
      </WindowFrame>
    );
  }

  if (!hasPassedDoctor) {
    return (
      <WindowFrame>
        <Doctor
          errorMessage={doctorError}
          isChecking={isCheckingDoctor}
          onContinue={() => void handleContinue()}
          onRetry={() => void runDoctor()}
          report={doctorReport}
        />
      </WindowFrame>
    );
  }

  const supportedPlatforms: ReleasePlatform[] = doctorReport?.supportedPlatforms ?? ['android'];

  return (
    <WindowFrame>
      <AppShell
        applications={applications}
        onAddApplication={() => { setSelectedApplication(null); setView('setup'); }}
        onOpenApplication={(applicationId) => void openApplication(applicationId)}
        onOpenHome={() => setView('home')}
        onThemeChange={(nextTheme) => void handleThemeChange(nextTheme)}
        selectedApplicationId={selectedApplication?.id ?? null}
        theme={theme}
      >
      {globalError !== null && <Alert className={styles.globalAlert} dismissible onClose={() => setGlobalError(null)} variant="danger">{globalError}</Alert>}
      {view === 'home' && (
        <ApplicationList
          applications={applications}
          onAddApplication={() => { setSelectedApplication(null); setView('setup'); }}
          onOpenApplication={(applicationId) => void openApplication(applicationId)}
        />
      )}
      {view === 'setup' && (
        <ApplicationSetup
          application={null}
          onCancel={() => setView('home')}
          onSaved={(application) => void handleSaved(application)}
          supportedPlatforms={supportedPlatforms}
        />
      )}
      {view === 'edit' && selectedApplication !== null && (
        <ApplicationSetup
          application={selectedApplication}
          onCancel={() => setView('detail')}
          onSaved={(application) => void handleSaved(application)}
          supportedPlatforms={supportedPlatforms}
        />
      )}
      {view === 'detail' && selectedApplication !== null && (
        <ApplicationDetail
          application={selectedApplication}
          fastActions={fastActions}
          history={history}
          isHistoryLoading={isHistoryLoading}
          onClearHistory={() => void handleClearHistory()}
          onCreateFastAction={() => { setReleaseIntent({ kind: 'createFastAction' }); setView('release'); }}
          onDelete={() => void handleDelete()}
          onDeleteFastAction={(fastActionId) => void handleDeleteFastAction(fastActionId)}
          onEdit={() => setView('edit')}
          onEditFastAction={(fastAction) => { setReleaseIntent({ fastAction, kind: 'editFastAction' }); setView('release'); }}
          onRunFastAction={(fastAction) => void handleRunFastAction(fastAction)}
          onStartRelease={() => { setReleaseIntent({ kind: 'newRelease' }); setView('release'); }}
          startingFastActionId={startingFastActionId}
        />
      )}
      {view === 'release' && selectedApplication !== null && releaseIntent !== null && (
        <ReleasePipeline
          application={selectedApplication}
          intent={releaseIntent}
          onClose={() => { setReleaseIntent(null); setView('detail'); }}
          onFinished={() => void handleReleaseFinished()}
          onApplicationUpdated={setSelectedApplication}
          onFastActionSaved={handleFastActionSaved}
          supportedPlatforms={supportedPlatforms}
        />
      )}
      {view !== 'home' && selectedApplication === null && view !== 'setup' && (
        <div className={styles.loading}><Spinner animation="border" size="sm" /> Loading application…</div>
      )}
      </AppShell>
    </WindowFrame>
  );
};
