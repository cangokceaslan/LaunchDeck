import type { ApplicationSummary, ThemePreference } from '@shared/contracts/domain';

export type AppShellProps = {
  applications: ApplicationSummary[];
  children: React.ReactNode;
  hasMoreApplications: boolean;
  isLoadingMoreApplications: boolean;
  onAddApplication: () => void;
  onLoadMoreApplications: () => void;
  onOpenApplication: (applicationId: string) => void;
  onOpenHome: () => void;
  onThemeChange: (theme: ThemePreference) => void;
  selectedApplicationId: string | null;
  theme: ThemePreference;
};
