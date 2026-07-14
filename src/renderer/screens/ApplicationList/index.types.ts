import type { ApplicationSummary } from '@shared/contracts/domain';

export type ApplicationListProps = {
  applications: ApplicationSummary[];
  onAddApplication: () => void;
  onOpenApplication: (applicationId: string) => void;
};
