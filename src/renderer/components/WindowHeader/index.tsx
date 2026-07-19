import { useState } from 'react';
import { SetupGuideModal } from '@components/SetupGuideModal';
import {
  isGeneralSetupReady,
  resolveSetupWorkflows,
} from '@components/SetupGuideModal/index.utils';
import type { WindowHeaderProps } from '@components/WindowHeader/index.types';
import launchIcon from '@renderer/assets/launch-icon.png';
import devIcon from '@renderer/assets/dev-icon.png';
import styles from '@components/WindowHeader/index.module.scss';

const productIcon = import.meta.env.DEV ? devIcon : launchIcon;

export const WindowHeader = ({
  application,
  doctorError,
  doctorReport,
  fileSystemPermissionError,
  fileSystemPermissionState,
  isCheckingDoctor,
  onReviewFileSystemPermissions,
  onRetryDoctor,
  reviewingFileSystemPermissionTarget,
}: WindowHeaderProps): React.JSX.Element => {
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);
  const workflows = resolveSetupWorkflows(doctorReport, application);
  const hasReadyWorkflow = workflows.some((workflow) => workflow.isReady);
  const isGeneralReady = isGeneralSetupReady(doctorReport, fileSystemPermissionState);
  const needsPermissionConfirmation =
    fileSystemPermissionState !== null &&
    fileSystemPermissionState.platform !== 'unsupported' &&
    !fileSystemPermissionState.hasConfirmedAccess;
  const setupTone = isCheckingDoctor || fileSystemPermissionState === null
    ? styles.setupChecking
    : (application === null ? isGeneralReady : hasReadyWorkflow && !needsPermissionConfirmation)
      ? styles.setupReady
      : styles.setupNeeded;

  return (
    <>
      <header className={styles.header}>
        <div
          className={styles.dragRegion}
          onDoubleClick={() => void window.desktopApi.windowToggleMaximize()}
        >
          <img alt="" aria-hidden="true" className={styles.productIcon} src={productIcon} />
          <div className={styles.productTitle}>
            <strong>LaunchDeck</strong>
            <span>Distribution operations</span>
          </div>
          <div className={styles.context}>
            <span aria-hidden="true" className={styles.statusDot} />
            Release distribution
          </div>
        </div>
        <button
          aria-haspopup="dialog"
          className={`${styles.setupButton} ${setupTone}`}
          onClick={() => setIsSetupGuideOpen(true)}
          title="View release setup requirements"
          type="button"
        >
          <span aria-hidden="true" className={styles.setupStatusDot} />
          Setup
        </button>
        <div className={styles.windowControls}>
          <button
            aria-label="Minimize window"
            className={styles.minimizeButton}
            onClick={() => void window.desktopApi.windowMinimize()}
            title="Minimize"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="M3 8.5h10" />
            </svg>
          </button>
          <button
            aria-label="Maximize or restore window"
            className={styles.maximizeButton}
            onClick={() => void window.desktopApi.windowToggleMaximize()}
            title="Maximize or restore"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <rect height="9" rx="1" width="9" x="3.5" y="3.5" />
            </svg>
          </button>
          <button
            aria-label="Close LaunchDeck"
            className={styles.closeButton}
            onClick={() => void window.desktopApi.windowClose()}
            title="Close"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="m4 4 8 8m0-8-8 8" />
            </svg>
          </button>
        </div>
      </header>
      <SetupGuideModal
        application={application}
        errorMessage={doctorError}
        fileSystemPermissionError={fileSystemPermissionError}
        fileSystemPermissionState={fileSystemPermissionState}
        isChecking={isCheckingDoctor}
        isOpen={isSetupGuideOpen}
        onClose={() => setIsSetupGuideOpen(false)}
        onReviewFileSystemPermissions={onReviewFileSystemPermissions}
        onRetry={onRetryDoctor}
        report={doctorReport}
        reviewingFileSystemPermissionTarget={reviewingFileSystemPermissionTarget}
      />
    </>
  );
};
