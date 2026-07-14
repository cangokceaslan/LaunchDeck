import type { ReleaseLogEntry, ReleaseResult } from '@shared/contracts/release';

export type PipelineProgressProps = {
  activePhase: string | null;
  completedPhases: number;
  isCancelling: boolean;
  logs: ReleaseLogEntry[];
  onCancel: () => void;
  percent: number;
  platform: 'android' | 'ios' | null;
  result: ReleaseResult | null;
  totalPhases: number;
};
