import type { StatusPillProps } from '@components/StatusPill/index.types';
import styles from '@components/StatusPill/index.module.scss';

export const StatusPill = ({ label, tone }: StatusPillProps): React.JSX.Element => (
  <span className={`${styles.pill} ${styles[tone]}`}>
    <span aria-hidden="true" className={styles.dot} />
    {label}
  </span>
);
