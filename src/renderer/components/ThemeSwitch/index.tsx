import type { ThemeSwitchProps } from '@components/ThemeSwitch/index.types';
import type { ThemePreference } from '@shared/contracts/domain';
import styles from '@components/ThemeSwitch/index.module.scss';

const OPTIONS: Array<{ label: string; theme: ThemePreference }> = [
  { label: 'System', theme: 'system' },
  { label: 'Light', theme: 'light' },
  { label: 'Dark', theme: 'dark' },
];

const ThemeIcon = ({ theme }: { theme: ThemePreference }): React.JSX.Element => {
  if (theme === 'system') {
    return (
      <svg aria-hidden="true" viewBox="0 0 18 18">
        <rect height="10" rx="2" width="14" x="2" y="2" />
        <path d="M6.5 15h5M9 12v3" />
      </svg>
    );
  }
  if (theme === 'light') {
    return (
      <svg aria-hidden="true" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="3" />
        <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18">
      <path d="M14.5 11.7A6.3 6.3 0 0 1 6.3 3.5a6.4 6.4 0 1 0 8.2 8.2Z" />
    </svg>
  );
};

export const ThemeSwitch = ({ onChange, theme }: ThemeSwitchProps): React.JSX.Element => (
  <fieldset className={styles.switch} data-selected-theme={theme}>
    <legend>Appearance</legend>
    {OPTIONS.map((option) => (
      <label key={option.theme} title={`${option.label} theme`}>
        <input
          checked={theme === option.theme}
          name="launchdeck-theme"
          onChange={() => onChange(option.theme)}
          type="radio"
          value={option.theme}
        />
        <span>
          <ThemeIcon theme={option.theme} />
          <span>{option.label}</span>
        </span>
      </label>
    ))}
  </fieldset>
);
