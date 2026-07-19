import { useEffect, useRef, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { AppShell } from '@components/AppShell';
import { FileSystemPermissionPrompt } from '@components/FileSystemPermissionPrompt';
import { WindowFrame } from '@components/WindowFrame';
import { ApplicationDetail } from '@screens/ApplicationDetail';
import { ApplicationList } from '@screens/ApplicationList';
import { ApplicationSetup } from '@screens/ApplicationSetup';
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
import type { FastAction, RunHistorySummary } from '@shared/contracts/release';
import styles from '@renderer/App.module.scss';

type View = 'home' | 'setup' | 'detail' | 'edit' | 'release';

const APPLICATION_PAGE_SIZE = 20;

export const App = (): React.JSX.Element => {
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [isCheckingDoctor, setIsCheckingDoctor] = useState(true);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [applicationCursor, setApplicationCursor] = useState<ApplicationListCursor | null>(null);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [isLoadingMoreApplications, setIsLoadingMoreApplications] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationDetailModel | null>(null);
  const [history, setHistory] = useState<RunHistorySummary[]>([]);
  const [fastActions, setFastActions] = useState<FastAction[]>([]);
  const [releaseIntent, setReleaseIntent] = useState<ReleasePipelineIntent | null>(null);
  const [startingFastActionId, setStartingFastActionId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [view, setView] = useState<View>('home');
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fileSystemPermissionState, setFileSystemPermissionState] =
    useState<FileSystemPermissionState | null>(null);
  const [fileSystemPermissionError, setFileSystemPermissionError] = useState<string | null>(
    null,
  );
  const [isPermissionPromptDismissed, setIsPermissionPromptDismissed] = useState(false);
  const [isReviewingFileSystemPermissions, setIsReviewingFileSystemPermissions] =
    useState(false);
  const hasStarted = useRef(false);
  const applicationQueryVersion = useRef(0);
  const isLoadingMoreApplicationsRef = useRef(false);

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
    void refreshApplications()
      .catch((error: unknown) => setGlobalError(normalizeErrorMessage(error)))
      .finally(() => setIsLoadingApplications(false));
    void window.desktopApi
      .getSettings()
      .then((settings) => setTheme(settings.theme))
      .catch((error: unknown) => setGlobalError(normalizeErrorMessage(error)));
    void window.desktopApi
      .getFileSystemPermissionState()
      .then(setFileSystemPermissionState)
      .catch((error: unknown) => setFileSystemPermissionError(normalizeErrorMessage(error)));
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
    setFileSystemPermissionError(null);
    setIsReviewingFileSystemPermissions(true);
    try {
      const permissionState = await window.desktopApi.reviewFileSystemPermissions(target);
      setFileSystemPermissionState(permissionState);
      setIsPermissionPromptDismissed(true);
    } catch (error) {
      setFileSystemPermissionError(normalizeErrorMessage(error));
    } finally {
      setIsReviewingFileSystemPermissions(false);
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
      await Promise.all([loadHistory(selectedApplication.id), refreshApplications()]);
    } catch (error) {
      setGlobalError(normalizeErrorMessage(error));
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

  const supportedPlatforms: ReleasePlatform[] = doctorReport?.supportedPlatforms ?? ['android'];

  return (
    <WindowFrame
      application={selectedApplication}
      doctorError={doctorError}
      doctorReport={doctorReport}
      fileSystemPermissionError={fileSystemPermissionError}
      fileSystemPermissionState={fileSystemPermissionState}
      isCheckingDoctor={isCheckingDoctor}
      isReviewingFileSystemPermissions={isReviewingFileSystemPermissions}
      onReviewFileSystemPermissions={(target) =>
        void handleReviewFileSystemPermissions(target)
      }
      onRetryDoctor={() => void runDoctor()}
    >
      {fileSystemPermissionState !== null &&
        fileSystemPermissionState.platform !== 'unsupported' && (
          <FileSystemPermissionPrompt
            errorMessage={fileSystemPermissionError}
            isOpen={
              !fileSystemPermissionState.hasReviewed && !isPermissionPromptDismissed
            }
            isReviewing={isReviewingFileSystemPermissions}
            onClose={() => setIsPermissionPromptDismissed(true)}
            onReview={(target) => void handleReviewFileSystemPermissions(target)}
            platform={fileSystemPermissionState.platform}
          />
        )}
      <AppShell
        applications={applications}
        hasMoreApplications={applicationCursor !== null}
        isLoadingMoreApplications={isLoadingMoreApplications}
        onAddApplication={() => { setSelectedApplication(null); setView('setup'); }}
        onLoadMoreApplications={() => void loadMoreApplications()}
        onOpenApplication={(applicationId) => void openApplication(applicationId)}
        onOpenHome={() => setView('home')}
        onThemeChange={(nextTheme) => void handleThemeChange(nextTheme)}
        selectedApplicationId={selectedApplication?.id ?? null}
        theme={theme}
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
          onAddApplication={() => { setSelectedApplication(null); setView('setup'); }}
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
