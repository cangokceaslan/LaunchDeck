import type { ThemePreference } from '@shared/contracts/domain';

export type ThemeSwitchProps = {
  onChange: (theme: ThemePreference) => void;
  theme: ThemePreference;
};
