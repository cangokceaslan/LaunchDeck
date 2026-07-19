import type { ApplicationDetail as ApplicationDetailModel } from '@shared/contracts/domain';
import type { FastAction, RunHistorySummary } from '@shared/contracts/release';

export type ApplicationDetailProps = {
  application: ApplicationDetailModel;
  fastActions: FastAction[];
  history: RunHistorySummary[];
  hasMoreHistory: boolean;
  isChangingIcon: boolean;
  isHistoryLoading: boolean;
  isLoadingMoreHistory: boolean;
  isSetupChecking: boolean;
  isSetupReady: boolean;
  onClearHistory: () => void;
  onChangeIcon: () => void;
  onCreateFastAction: () => void;
  onDelete: () => void;
  onDeleteFastAction: (fastActionId: string) => void;
  onEdit: () => void;
  onEditFastAction: (fastAction: FastAction) => void;
  onLoadMoreHistory: () => void;
  onOpenHistory: (run: RunHistorySummary) => void;
  onRemoveIcon: () => void;
  onRepeatHistory: (run: RunHistorySummary) => void;
  onRunFastAction: (fastAction: FastAction) => void;
  onShowSetup: () => void;
  onStartRelease: () => void;
};
