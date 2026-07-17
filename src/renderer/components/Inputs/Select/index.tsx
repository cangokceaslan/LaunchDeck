import type { SelectProps } from '@components/Inputs/Select/index.types';
import styles from '@components/Inputs/Select/index.module.scss';

export const Select = ({ isInvalid = false, ...props }: SelectProps): React.JSX.Element => (
  <select
    {...props}
    aria-invalid={isInvalid || props['aria-invalid'] === true}
    className={`${styles.select}${isInvalid ? ` ${styles.invalid}` : ''}`}
  />
);
