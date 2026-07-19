import { WindowHeader } from '@components/WindowHeader';
import type { WindowFrameProps } from '@components/WindowFrame/index.types';
import styles from '@components/WindowFrame/index.module.scss';

export const WindowFrame = ({
  application,
  children,
  doctorError,
  doctorReport,
  fileSystemPermissionError,
  fileSystemPermissionState,
  isCheckingDoctor,
  onReviewFileSystemPermissions,
  onRetryDoctor,
  reviewingFileSystemPermissionTarget,
}: WindowFrameProps): React.JSX.Element => (
  <div className={styles.frame}>
    <WindowHeader
      application={application}
      doctorError={doctorError}
      doctorReport={doctorReport}
      fileSystemPermissionError={fileSystemPermissionError}
      fileSystemPermissionState={fileSystemPermissionState}
      isCheckingDoctor={isCheckingDoctor}
      onReviewFileSystemPermissions={onReviewFileSystemPermissions}
      onRetryDoctor={onRetryDoctor}
      reviewingFileSystemPermissionTarget={reviewingFileSystemPermissionTarget}
    />
    <div className={styles.content}>{children}</div>
  </div>
);
