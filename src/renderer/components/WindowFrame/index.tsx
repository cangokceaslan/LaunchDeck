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
  isReviewingFileSystemPermissions,
  onReviewFileSystemPermissions,
  onRetryDoctor,
  onThemeChange,
  theme,
}: WindowFrameProps): React.JSX.Element => (
  <div className={styles.frame}>
    <WindowHeader
      application={application}
      doctorError={doctorError}
      doctorReport={doctorReport}
      fileSystemPermissionError={fileSystemPermissionError}
      fileSystemPermissionState={fileSystemPermissionState}
      isCheckingDoctor={isCheckingDoctor}
      isReviewingFileSystemPermissions={isReviewingFileSystemPermissions}
      onReviewFileSystemPermissions={onReviewFileSystemPermissions}
      onRetryDoctor={onRetryDoctor}
      onThemeChange={onThemeChange}
      theme={theme}
    />
    <div className={styles.content}>{children}</div>
  </div>
);
