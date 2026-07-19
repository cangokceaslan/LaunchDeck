import { useEffect, useRef, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { AppShell } from '@components/AppShell';
import { FileSystemPermissionPrompt } from '@components/FileSystemPermissionPrompt';
import { SetupGuideModal } from '@components/SetupGuideModal';
import { resolveSetupWorkflows } from '@components/SetupGuideModal/index.utils';
import { SplashLoader } from '@components/SplashLoader';
import { WindowFrame } from '@components/WindowFrame';
import { ApplicationDetail } from '@screens/ApplicationDetail';
import { ApplicationList } from '@screens/ApplicationList';
import { ApplicationSetup } from '@screens/ApplicationSetup';
import { ReleaseHistoryDetail } from '@screens/ReleaseHistoryDetail';
import { ReleasePipeline } from '@screens/ReleasePipeline';
import type { ReleasePipelineIntent } from '@screens/ReleasePipeline/index.types';
import { normalizeErrorMessage } from '@renderer/utils/formatting';
import type {
  ApplicationDetail as ApplicationDetailModel,
  ApplicationListCursor,
  ApplicationSummary,
  ReleasePlatform,
  ThemePreference,
} from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';
import type {
  FileSystemPermissionState,
  FileSystemPermissionTarget,
} from '@shared/contracts/permissions';
import type {
  FastAction,
  RunHistoryCursor,
  RunHistorySummary,
} from '@shared/contracts/release';
import styles from '@renderer/App.module.scss';

type View = 'home' | 'setup' | 'detail' | 'edit' | 'history' | 'release';

const APPLICATION_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 8;

export const App = (): React.JSX.Element => {
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [isCheckingDoctor, setIsCheckingDoctor] = useState(true);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [applicationCursor, setApplicationCursor] = useState<ApplicationListCursor | null>(null);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [isPreparingWorkspace, setIsPreparingWorkspace] = useState(true);
  const [isLoadingMoreApplications, setIsLoadingMoreApplications] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationDetailModel | null>(null);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<RunHistorySummary | null>(null);
  const [history, setHistory] = useState<RunHistorySummary[]>([]);
  const [historyCursor, setHistoryCursor] = useState<RunHistoryCursor | null>(null);
  const [fastActions, setFastActions] = useState<FastAction[]>([]);
  const [releaseIntent, setReleaseIntent] = useState<ReleasePipelineIntent | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [isChangingApplicationIcon, setIsChangingApplicationIcon] = useState(false);
  const [view, setView] = useState<View>('home');
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [isApplicationSetupGuideOpen, setIsApplicationSetupGuideOpen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fileSystemPermissionState, setFileSystemPermissionState] =
    useState<FileSystemPermissionState | null>(null);
  const [fileSystemPermissionError, setFileSystemPermissionError] = useState<string | null>(
    null,
  );
  const [isPermissionPromptDismissed, setIsPermissionPromptDismissed] = useState(false);
  const [reviewingFileSystemPermissionTarget, setReviewingFileSystemPermissionTarget] =
    useState<FileSystemPermissionTarget | null>(null);
  const hasStarted = useRef(false);
  const applicationQueryVersion = useRef(0);
  const historyQueryVersion = useRef(0);
  const isLoadingMoreApplicationsRef = useRef(false);
  const isLoadingMoreHistoryRef = useRef(false);

  const refreshApplications = async (): Promise<ApplicationSummary[]> => {
    const queryVersion = applicationQueryVersion.current + 1;
    applicationQueryVersion.current = queryVersion;
    const page = await window.desktopApi.listApplications({ pageSize: APPLICATION_PAGE_SIZE });
    if (applicationQueryVersion.current === queryVersion) {
      setApplications(page.applications);
      setApplicationCursor(page.nextCursor);
    }
    return page.applications;
  };

  const loadMoreApplications = async (): Promise<void> => {
    if (applicationCursor === null || isLoadingMoreApplicationsRef.current) return;
    const queryVersion = applicationQueryVersion.current;
    const cursor = applicationCursor;
    isLoadingMoreApplicationsRef.current = true;
    setIsLoadingMoreApplications(true);
    try {
      const page = await window.desktopApi.listApplications({
        cursor,
        pageSize: APPLICATION_PAGE_SIZE,
      });
      if (applicationQueryVersion.current !== queryVersion) return;
      setApplications((currentApplications) => {
        const loadedIds = new Set(currentApplications.map((application) => application.id));
        return [
          ...currentApplications,
          ...page.applications.filter((application) => !loadedIds.has(application.id)),
        ];
      });
      setApplicationCursor(page.nextCursor);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    } finally {
      isLoadingMoreApplicationsRef.current = false;
      setIsLoadingMoreApplications(false);
    }
  };

  const runDoctor = async (): Promise<void> => {
    setDoctorError(null);
    setIsCheckingDoctor(true);
    try {
      const report = await window.desktopApi.runDoctor();
      setDoctorReport(report);
    } catch (error) {
      setDoctorError(normalizeErrorMessage(error));
    } finally {
      setIsCheckingDoctor(false);
    }
  };

  const loadHistory = async (applicationId: string): Promise<void> => {
    const queryVersion = historyQueryVersion.current + 1;
    historyQueryVersion.current = queryVersion;
    setIsHistoryLoading(true);
    try {
      const page = await window.desktopApi.listRunHistory({
        applicationId,
        pageSize: HISTORY_PAGE_SIZE,
      });
      if (historyQueryVersion.current === queryVersion) {
        setHistory(page.runs);
        setHistoryCursor(page.nextCursor);
      }
    } finally {
      if (historyQueryVersion.current === queryVersion) setIsHistoryLoading(false);
    }
  };

  const loadMoreHistory = async (): Promise<void> => {
    if (
      selectedApplication === null ||
      historyCursor === null ||
      isLoadingMoreHistoryRef.current
    ) return;
    const queryVersion = historyQueryVersion.current;
    const cursor = historyCursor;
    isLoadingMoreHistoryRef.current = true;
    setIsLoadingMoreHistory(true);
    try {
      const page = await window.desktopApi.listRunHistory({
        applicationId: selectedApplication.id,
        cursor,
        pageSize: HISTORY_PAGE_SIZE,
      });
      if (historyQueryVersion.current !== queryVersion) return;
      setHistory((currentHistory) => {
        const loadedIds = new Set(currentHistory.map((run) => run.id));
        return [...currentHistory, ...page.runs.filter((run) => !loadedIds.has(run.id))];
      });
      setHistoryCursor(page.nextCursor);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    } finally {
      isLoadingMoreHistoryRef.current = false;
      setIsLoadingMoreHistory(false);
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
      setHistoryCursor(null);
      setSelectedHistoryRun(null);
      setIsApplicationSetupGuideOpen(false);
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
    const applicationsRequest = refreshApplications()
      .catch((error: unknown) => setGlobalError(normalizeErrorMessage(error)))
      .finally(() => setIsLoadingApplications(false));
    const settingsRequest = window.desktopApi
      .getSettings()
      .then((settings) => setTheme(settings.theme))
      .catch((error: unknown) => setGlobalError(normalizeErrorMessage(error)));
    const permissionRequest = window.desktopApi
      .getFileSystemPermissionState()
      .then(setFileSystemPermissionState)
      .catch((error: unknown) => setFileSystemPermissionError(normalizeErrorMessage(error)));
    void Promise.allSettled([applicationsRequest, settingsRequest, permissionRequest]).then(() =>
      setIsPreparingWorkspace(false),
    );
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (): void => {
      const resolvedTheme = theme === 'system' && mediaQuery.matches ? 'dark' : theme;
      const activeTheme = resolvedTheme === 'system' ? 'light' : resolvedTheme;
      document.documentElement.dataset.theme = activeTheme;
      document.documentElement.dataset.bsTheme = activeTheme;
    };
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  const handleThemeChange = async (nextTheme: ThemePreference): Promise<void> => {
    setTheme(nextTheme);
    try {
      await window.desktopApi.updateTheme(nextTheme);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
  };

  const handleReviewFileSystemPermissions = async (
    target: FileSystemPermissionTarget,
  ): Promise<void> => {
    if (reviewingFileSystemPermissionTarget !== null) return;
    setFileSystemPermissionError(null);
    setReviewingFileSystemPermissionTarget(target);
    try {
      const result = await window.desktopApi.requestFileSystemAccess(target);
      setFileSystemPermissionState(result.state);
      if (result.outcome === 'accessConfirmed') {
        setIsPermissionPromptDismissed(true);
      }
    } catch (error) {
      setFileSystemPermissionError(normalizeErrorMessage(error));
      try {
        setFileSystemPermissionState(await window.desktopApi.getFileSystemPermissionState());
      } catch {
        // Preserve the actionable permission error from the original request.
      }
    } finally {
      setReviewingFileSystemPermissionTarget(null);
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
      setSelectedHistoryRun(null);
      setHistory([]);
      setHistoryCursor(null);
      setFastActions([]);
      setReleaseIntent(null);
      setIsApplicationSetupGuideOpen(false);
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
      await Promise.all([loadHistory(selectedApplication.id), refreshApplications()]);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    }
  };

  const handleChangeApplicationIcon = async (): Promise<void> => {
    if (selectedApplication === null || isChangingApplicationIcon) return;
    setGlobalError(null);
    setIsChangingApplicationIcon(true);
    try {
      const selection = await window.desktopApi.chooseApplicationIcon();
      if (selection.status === 'cancelled') return;
      const updatedApplication = await window.desktopApi.updateApplicationIcon({
        applicationId: selectedApplication.id,
        iconDataUrl: selection.dataUrl,
      });
      setSelectedApplication(updatedApplication);
      await refreshApplications();
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    } finally {
      setIsChangingApplicationIcon(false);
    }
  };

  const handleRemoveApplicationIcon = async (): Promise<void> => {
    if (
      selectedApplication === null ||
      selectedApplication.iconDataUrl === null ||
      isChangingApplicationIcon
    ) return;
    setGlobalError(null);
    setIsChangingApplicationIcon(true);
    try {
      const updatedApplication = await window.desktopApi.updateApplicationIcon({
        applicationId: selectedApplication.id,
        iconDataUrl: null,
      });
      setSelectedApplication(updatedApplication);
      await refreshApplications();
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
    } finally {
      setIsChangingApplicationIcon(false);
    }
  };

  const handleReleaseFinished = async (): Promise<void> => {
    if (selectedApplication === null) return;
    try {
      await Promise.all([loadHistory(selectedApplication.id), refreshApplications()]);
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

  const handleRunFastAction = (fastAction: FastAction): void => {
    if (selectedApplication === null) return;
    setGlobalError(null);
    setReleaseIntent({ fastAction, kind: 'runFastAction' });
    setView('release');
  };

  const handleRepeatHistory = (run: RunHistorySummary): void => {
    if (run.configuration === null) return;
    setReleaseIntent({ configuration: run.configuration, kind: 'repeatRelease' });
    setView('release');
  };

  const supportedPlatforms: ReleasePlatform[] = doctorReport?.supportedPlatforms ?? ['android'];
  const applicationSetupWorkflows = resolveSetupWorkflows(doctorReport, selectedApplication);
  const needsPermissionConfirmation =
    fileSystemPermissionState !== null &&
    fileSystemPermissionState.isPermissionRequired &&
    fileSystemPermissionState.platform !== 'unsupported' &&
    !fileSystemPermissionState.hasConfirmedAccess;
  const isApplicationSetupChecking = isCheckingDoctor || fileSystemPermissionState === null;
  const isApplicationSetupReady =
    applicationSetupWorkflows.some((workflow) => workflow.isReady) &&
    !needsPermissionConfirmation;

  if (isPreparingWorkspace) return <SplashLoader />;

  return (
    <WindowFrame
      doctorError={doctorError}
      doctorReport={doctorReport}
      fileSystemPermissionError={fileSystemPermissionError}
      fileSystemPermissionState={fileSystemPermissionState}
      isCheckingDoctor={isCheckingDoctor}
      reviewingFileSystemPermissionTarget={reviewingFileSystemPermissionTarget}
      onReviewFileSystemPermissions={(target) =>
        void handleReviewFileSystemPermissions(target)
      }
      onRetryDoctor={() => void runDoctor()}
      onThemeChange={(nextTheme) => void handleThemeChange(nextTheme)}
      theme={theme}
    >
      {fileSystemPermissionState !== null &&
        fileSystemPermissionState.isPermissionRequired &&
        fileSystemPermissionState.platform !== 'unsupported' && (
          <FileSystemPermissionPrompt
            directRequestAttempts={fileSystemPermissionState.directRequestAttempts}
            errorMessage={fileSystemPermissionError}
            isOpen={
              !fileSystemPermissionState.hasConfirmedAccess && !isPermissionPromptDismissed
            }
            isReviewing={reviewingFileSystemPermissionTarget !== null}
            onClose={() => setIsPermissionPromptDismissed(true)}
            onReview={(target) => void handleReviewFileSystemPermissions(target)}
            platform={fileSystemPermissionState.platform}
            settingsTargets={fileSystemPermissionState.settingsTargets}
          />
        )}
      <AppShell
        applications={applications}
        hasMoreApplications={applicationCursor !== null}
        isLoadingMoreApplications={isLoadingMoreApplications}
        onAddApplication={() => { setSelectedApplication(null); setSelectedHistoryRun(null); setView('setup'); }}
        onLoadMoreApplications={() => void loadMoreApplications()}
        onOpenApplication={(applicationId) => void openApplication(applicationId)}
        onOpenHome={() => setView('home')}
        selectedApplicationId={selectedApplication?.id ?? null}
      >
      {globalError !== null && <Alert className={styles.globalAlert} dismissible onClose={() => setGlobalError(null)} variant="danger">{globalError}</Alert>}
      {view === 'home' && isLoadingApplications && (
        <div className={styles.loading} role="status">
          <Spinner animation="border" size="sm" /> Loading applications…
        </div>
      )}
      {view === 'home' && !isLoadingApplications && (
        <ApplicationList
          applications={applications}
          hasMoreApplications={applicationCursor !== null}
          isLoadingMoreApplications={isLoadingMoreApplications}
          onAddApplication={() => { setSelectedApplication(null); setSelectedHistoryRun(null); setView('setup'); }}
          onLoadMoreApplications={() => void loadMoreApplications()}
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
          hasMoreHistory={historyCursor !== null}
          history={history}
          isChangingIcon={isChangingApplicationIcon}
          isHistoryLoading={isHistoryLoading}
          isLoadingMoreHistory={isLoadingMoreHistory}
          isSetupChecking={isApplicationSetupChecking}
          isSetupReady={isApplicationSetupReady}
          onChangeIcon={() => void handleChangeApplicationIcon()}
          onClearHistory={() => void handleClearHistory()}
          onCreateFastAction={() => { setReleaseIntent({ kind: 'createFastAction' }); setView('release'); }}
          onDelete={() => void handleDelete()}
          onDeleteFastAction={(fastActionId) => void handleDeleteFastAction(fastActionId)}
          onEdit={() => { setIsApplicationSetupGuideOpen(false); setView('edit'); }}
          onEditFastAction={(fastAction) => { setReleaseIntent({ fastAction, kind: 'editFastAction' }); setView('release'); }}
          onLoadMoreHistory={() => void loadMoreHistory()}
          onOpenHistory={(run) => { setSelectedHistoryRun(run); setView('history'); }}
          onRemoveIcon={() => void handleRemoveApplicationIcon()}
          onRepeatHistory={handleRepeatHistory}
          onRunFastAction={handleRunFastAction}
          onShowSetup={() => setIsApplicationSetupGuideOpen(true)}
          onStartRelease={() => { setReleaseIntent({ kind: 'newRelease' }); setView('release'); }}
        />
      )}
      {view === 'history' && selectedApplication !== null && selectedHistoryRun !== null && (
        <ReleaseHistoryDetail
          applicationName={selectedApplication.name}
          onBack={() => setView('detail')}
          onRepeat={handleRepeatHistory}
          run={selectedHistoryRun}
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
      {selectedApplication !== null && (
        <SetupGuideModal
          application={selectedApplication}
          errorMessage={doctorError}
          fileSystemPermissionError={fileSystemPermissionError}
          fileSystemPermissionState={fileSystemPermissionState}
          isChecking={isCheckingDoctor}
          isOpen={view === 'detail' && isApplicationSetupGuideOpen}
          onClose={() => setIsApplicationSetupGuideOpen(false)}
          onReviewFileSystemPermissions={(target) =>
            void handleReviewFileSystemPermissions(target)
          }
          onRetry={() => void runDoctor()}
          report={doctorReport}
          reviewingFileSystemPermissionTarget={reviewingFileSystemPermissionTarget}
        />
      )}
    </WindowFrame>
  );
};
