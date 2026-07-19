import type { ApplicationSummary } from '@shared/contracts/domain';

export type AppShellProps = {
  applications: ApplicationSummary[];
  children: React.ReactNode;
  hasMoreApplications: boolean;
  isLoadingMoreApplications: boolean;
  onAddApplication: () => void;
  onLoadMoreApplications: () => void;
  onOpenApplication: (applicationId: string) => void;
  onOpenHome: () => void;
  selectedApplicationId: string | null;
};
