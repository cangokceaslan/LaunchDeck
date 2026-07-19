import { AppShell } from '@components/AppShell';
import { PipelineProgress } from '@components/PipelineProgress';
import { SetupGuideModal } from '@components/SetupGuideModal';
import { WindowFrame } from '@components/WindowFrame';
import { ApplicationDetail } from '@screens/ApplicationDetail';
import { ApplicationList } from '@screens/ApplicationList';
import { ApplicationSetup } from '@screens/ApplicationSetup';
import { Doctor } from '@screens/Doctor';
import { ReleaseHistoryDetail } from '@screens/ReleaseHistoryDetail';
import { ReleasePipeline } from '@screens/ReleasePipeline';
import {
  application,
  applicationSummary,
  doctorReport,
  fastAction,
  permissionState,
  releaseLogs,
  runHistory,
} from '@screenshots/fixtures';

type ScreenshotScenario =
  | 'application-detail'
  | 'application-setup'
  | 'applications'
  | 'doctor'
  | 'pipeline-progress'
  | 'release-history'
  | 'release-pipeline'
  | 'setup-guide';

const scenarios: ScreenshotScenario[] = [
  'doctor',
  'applications',
  'application-setup',
  'application-detail',
  'setup-guide',
  'release-pipeline',
  'pipeline-progress',
  'release-history',
];

const noop = (): void => undefined;

const resolveScenario = (): ScreenshotScenario => {
  const requestedScenario = new URLSearchParams(window.location.search).get('scenario');
  return scenarios.find((scenario) => scenario === requestedScenario) ?? 'applications';
};

const ScreenFrame = ({
  children,
  selectedApplicationId,
}: {
  children: React.ReactNode;
  selectedApplicationId: string | null;
}): React.JSX.Element => (
  <WindowFrame
    doctorError={null}
    doctorReport={doctorReport}
    fileSystemPermissionError={null}
    fileSystemPermissionState={permissionState}
    isCheckingDoctor={false}
    onRetryDoctor={noop}
    onReviewFileSystemPermissions={noop}
    onThemeChange={noop}
    reviewingFileSystemPermissionTarget={null}
    theme="light"
  >
    <AppShell
      applications={[applicationSummary]}
      hasMoreApplications={false}
      isLoadingMoreApplications={false}
      onAddApplication={noop}
      onLoadMoreApplications={noop}
      onOpenApplication={noop}
      onOpenHome={noop}
      selectedApplicationId={selectedApplicationId}
    >
      {children}
    </AppShell>
  </WindowFrame>
);

const ApplicationDetailFixture = (): React.JSX.Element => (
  <ApplicationDetail
    application={application}
    fastActions={[fastAction]}
    hasMoreHistory={false}
    history={[runHistory]}
    isChangingIcon={false}
    isHistoryLoading={false}
    isLoadingMoreHistory={false}
    isSetupChecking={false}
    isSetupReady
    onChangeIcon={noop}
    onClearHistory={noop}
    onCreateFastAction={noop}
    onDelete={noop}
    onDeleteFastAction={noop}
    onEdit={noop}
    onEditFastAction={noop}
    onLoadMoreHistory={noop}
    onOpenHistory={noop}
    onRemoveIcon={noop}
    onRepeatHistory={noop}
    onRunFastAction={noop}
    onShowSetup={noop}
    onStartRelease={noop}
  />
);

export const ScreenshotApp = (): React.JSX.Element => {
  const scenario = resolveScenario();

  if (scenario === 'doctor') {
    return (
      <Doctor
        errorMessage={null}
        isChecking={false}
        onContinue={noop}
        onRetry={noop}
        report={doctorReport}
      />
    );
  }

  if (scenario === 'applications') {
    return (
      <ScreenFrame selectedApplicationId={null}>
        <ApplicationList
          applications={[applicationSummary]}
          hasMoreApplications={false}
          isLoadingMoreApplications={false}
          onAddApplication={noop}
          onLoadMoreApplications={noop}
          onOpenApplication={noop}
        />
      </ScreenFrame>
    );
  }

  if (scenario === 'application-setup') {
    return (
      <ScreenFrame selectedApplicationId={application.id}>
        <ApplicationSetup
          application={application}
          onCancel={noop}
          onSaved={noop}
          supportedPlatforms={['android', 'ios']}
        />
      </ScreenFrame>
    );
  }

  if (scenario === 'application-detail') {
    return (
      <ScreenFrame selectedApplicationId={application.id}>
        <ApplicationDetailFixture />
      </ScreenFrame>
    );
  }

  if (scenario === 'setup-guide') {
    return (
      <ScreenFrame selectedApplicationId={application.id}>
        <ApplicationDetailFixture />
        <SetupGuideModal
          application={application}
          errorMessage={null}
          fileSystemPermissionError={null}
          fileSystemPermissionState={permissionState}
          isChecking={false}
          isOpen
          onClose={noop}
          onRetry={noop}
          onReviewFileSystemPermissions={noop}
          report={doctorReport}
          reviewingFileSystemPermissionTarget={null}
        />
      </ScreenFrame>
    );
  }

  if (scenario === 'release-pipeline') {
    return (
      <ScreenFrame selectedApplicationId={application.id}>
        <ReleasePipeline
          application={application}
          intent={{ kind: 'newRelease' }}
          onApplicationUpdated={noop}
          onClose={noop}
          onFastActionSaved={noop}
          onFinished={noop}
          supportedPlatforms={['android', 'ios']}
        />
      </ScreenFrame>
    );
  }

  if (scenario === 'pipeline-progress') {
    return (
      <ScreenFrame selectedApplicationId={application.id}>
        <div className="screenshot-pipeline-page">
          <PipelineProgress
            activePhase="upload"
            completedPhases={8}
            isCancelling={false}
            logs={releaseLogs}
            mode="buildAndUpload"
            onCancel={noop}
            percent={67}
            platform="ios"
            platforms={['android', 'ios']}
            progressKind="reported"
            result={null}
            startedAt="2026-07-20T09:30:00.000Z"
            totalPhases={12}
          />
        </div>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame selectedApplicationId={application.id}>
      <ReleaseHistoryDetail
        applicationName={application.name}
        onBack={noop}
        onRepeat={noop}
        run={runHistory}
      />
    </ScreenFrame>
  );
};
