import type { ApplicationDetail as ApplicationDetailModel } from '@shared/contracts/domain';
import type { FastAction, RunHistorySummary } from '@shared/contracts/release';

export type ApplicationDetailProps = {
  application: ApplicationDetailModel;
  fastActions: FastAction[];
  history: RunHistorySummary[];
  isHistoryLoading: boolean;
  onClearHistory: () => void;
  onCreateFastAction: () => void;
  onDelete: () => void;
  onDeleteFastAction: (fastActionId: string) => void;
  onEdit: () => void;
  onEditFastAction: (fastAction: FastAction) => void;
  onRunFastAction: (fastAction: FastAction) => void;
  onStartRelease: () => void;
  startingFastActionId: string | null;
};
