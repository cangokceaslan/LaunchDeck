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
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <rect height="9" rx="1.5" width="12" x="2" y="2" />
        <path d="M6 13.5h4M8 11v2.5" />
      </svg>
    );
  }
  if (theme === 'light') {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M12.6 3.4l-.9.9M4.3 11.7l-.9.9" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M12.8 10.4A5.7 5.7 0 0 1 5.6 3.2 5.7 5.7 0 1 0 12.8 10.4Z" />
    </svg>
  );
};

export const ThemeSwitch = ({ onChange, theme }: ThemeSwitchProps): React.JSX.Element => (
  <fieldset className={styles.switch} data-selected-theme={theme}>
    <legend className={styles.legend}>Appearance</legend>
    <span aria-hidden="true" className={styles.indicator} />
    {OPTIONS.map((option) => (
      <label key={option.theme} title={`${option.label} theme`}>
        <input
          checked={theme === option.theme}
          name="launchdeck-theme"
          onChange={() => onChange(option.theme)}
          type="radio"
          value={option.theme}
        />
        <span className={styles.option}>
          <ThemeIcon theme={option.theme} />
          <span>{option.label}</span>
        </span>
      </label>
    ))}
  </fieldset>
);
