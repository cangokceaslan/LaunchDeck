import type { SwitchProps } from '@components/Inputs/Switch/index.types';
import styles from '@components/Inputs/Switch/index.module.scss';

export const Switch = ({
  checked,
  description,
  label,
  onChange,
  ...props
}: SwitchProps): React.JSX.Element => (
  <label className={`${styles.switch}${props.disabled ? ` ${styles.disabled}` : ''}`}>
    <input
      {...props}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      role="switch"
      type="checkbox"
    />
    <span aria-hidden="true" className={styles.track}><i /></span>
    <span className={styles.copy}>
      <strong>{label}</strong>
      {description !== undefined && <small>{description}</small>}
    </span>
  </label>
);
