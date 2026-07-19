import type { ApplicationSummary } from '@shared/contracts/domain';

export type ApplicationListProps = {
  applications: ApplicationSummary[];
  hasMoreApplications: boolean;
  isLoadingMoreApplications: boolean;
  onAddApplication: () => void;
  onLoadMoreApplications: () => void;
  onOpenApplication: (applicationId: string) => void;
};
