import { WindowHeader } from '@components/WindowHeader';
import type { WindowFrameProps } from '@components/WindowFrame/index.types';
import styles from '@components/WindowFrame/index.module.scss';

export const WindowFrame = ({ children }: WindowFrameProps): React.JSX.Element => (
  <div className={styles.frame}>
    <WindowHeader />
    <div className={styles.content}>{children}</div>
  </div>
);
