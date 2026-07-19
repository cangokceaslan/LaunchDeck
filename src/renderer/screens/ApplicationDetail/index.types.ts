import type { ApplicationDetail as ApplicationDetailModel } from '@shared/contracts/domain';
import type { FastAction, RunHistorySummary } from '@shared/contracts/release';

export type ApplicationDetailProps = {
  application: ApplicationDetailModel;
  fastActions: FastAction[];
  history: RunHistorySummary[];
  isChangingIcon: boolean;
  isHistoryLoading: boolean;
  isSetupChecking: boolean;
  isSetupReady: boolean;
  onClearHistory: () => void;
  onChangeIcon: () => void;
  onCreateFastAction: () => void;
  onDelete: () => void;
  onDeleteFastAction: (fastActionId: string) => void;
  onEdit: () => void;
  onEditFastAction: (fastAction: FastAction) => void;
  onRemoveIcon: () => void;
  onRepeatHistory: (run: RunHistorySummary) => void;
  onRunFastAction: (fastAction: FastAction) => void;
  onShowSetup: () => void;
  onStartRelease: () => void;
  startingFastActionId: string | null;
};
