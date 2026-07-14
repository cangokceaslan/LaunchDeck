import type { ApplicationDetail as ApplicationDetailModel } from '@shared/contracts/domain';
import type { RunHistorySummary } from '@shared/contracts/release';

export type ApplicationDetailProps = {
  application: ApplicationDetailModel;
  history: RunHistorySummary[];
  isHistoryLoading: boolean;
  onClearHistory: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onStartRelease: () => void;
};
