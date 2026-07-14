import { Button } from 'react-bootstrap';
import type { EmptyStateProps } from '@components/EmptyState/index.types';
import styles from '@components/EmptyState/index.module.scss';

export const EmptyState = ({
  actionLabel,
  description,
  onAction,
  title,
}: EmptyStateProps): React.JSX.Element => (
  <section className={styles.emptyState}>
    <div aria-hidden="true" className={styles.symbol}>+</div>
    <h2>{title}</h2>
    <p>{description}</p>
    <Button onClick={onAction}>{actionLabel}</Button>
  </section>
);
