import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { AppShell } from '@components/AppShell';
import { ApplicationDetail } from '@screens/ApplicationDetail';
import { ApplicationList } from '@screens/ApplicationList';
import { ApplicationSetup } from '@screens/ApplicationSetup';
import { Doctor } from '@screens/Doctor';
import { ReleasePipeline } from '@screens/ReleasePipeline';
import { normalizeErrorMessage } from '@renderer/utils/formatting';
import type {
  ApplicationDetail as ApplicationDetailModel,
  ApplicationSummary,
  ReleasePlatform,
  ThemePreference,
} from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';
import type { RunHistorySummary } from '@shared/contracts/release';
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
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [view, setView] = useState<View>('home');
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [globalError, setGlobalError] = useState<string | null>(null);

  const runDoctor = async (): Promise<void> => {
    setDoctorError(null);
    setIsCheckingDoctor(true);
    try {
      setDoctorReport(await window.desktopApi.runDoctor());
    } catch (error) {
      setDoctorError(normalizeErrorMessage(error));
    } finally {
      setIsCheckingDoctor(false);
    }
  };

  const refreshApplications = async (): Promise<ApplicationSummary[]> => {
    const nextApplications = await window.desktopApi.listApplications();
    setApplications(nextApplications);
    return nextApplications;
  };

  const loadHistory = async (applicationId: string): Promise<void> => {
    setIsHistoryLoading(true);
    try {
      setHistory(await window.desktopApi.listRunHistory(applicationId));
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const openApplication = async (applicationId: string): Promise<void> => {
    setGlobalError(null);
    try {
      const application = await window.desktopApi.getApplication(applicationId);
      if (application === null) {
        setGlobalError('Application not found.');
        return;
      }
      setSelectedApplication(application);
      setView('detail');
      await loadHistory(applicationId);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
  };

  useEffect(() => {
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
    setHasPassedDoctor(true);
    try {
      await refreshApplications();
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
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
    await loadHistory(application.id);
    setView('detail');
  };

  const handleDelete = async (): Promise<void> => {
    if (selectedApplication === null) return;
    try {
      await window.desktopApi.deleteApplication(selectedApplication.id);
      setSelectedApplication(null);
      setHistory([]);
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
    setView('detail');
  };

  if (!hasPassedDoctor) {
    return (
      <Doctor
        errorMessage={doctorError}
        isChecking={isCheckingDoctor}
        onContinue={() => void handleContinue()}
        onRetry={() => void runDoctor()}
        report={doctorReport}
      />
    );
  }

  const supportedPlatforms: ReleasePlatform[] = doctorReport?.supportedPlatforms ?? ['android'];

  return (
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
          history={history}
          isHistoryLoading={isHistoryLoading}
          onClearHistory={() => void handleClearHistory()}
          onDelete={() => void handleDelete()}
          onEdit={() => setView('edit')}
          onStartRelease={() => setView('release')}
        />
      )}
      {view === 'release' && selectedApplication !== null && (
        <ReleasePipeline
          application={selectedApplication}
          onClose={() => setView('detail')}
          onFinished={() => void handleReleaseFinished()}
          supportedPlatforms={supportedPlatforms}
        />
      )}
      {view !== 'home' && selectedApplication === null && view !== 'setup' && (
        <div className={styles.loading}><Spinner animation="border" size="sm" /> Loading application…</div>
      )}
    </AppShell>
  );
};
