import { WindowHeader } from '@components/WindowHeader';
import type { WindowFrameProps } from '@components/WindowFrame/index.types';
import styles from '@components/WindowFrame/index.module.scss';

export const WindowFrame = ({
  application,
  children,
  doctorError,
  doctorReport,
  isCheckingDoctor,
  onRetryDoctor,
}: WindowFrameProps): React.JSX.Element => (
  <div className={styles.frame}>
    <WindowHeader
      application={application}
      doctorError={doctorError}
      doctorReport={doctorReport}
      isCheckingDoctor={isCheckingDoctor}
      onRetryDoctor={onRetryDoctor}
    />
    <div className={styles.content}>{children}</div>
  </div>
);
