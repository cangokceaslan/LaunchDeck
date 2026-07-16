import type { ReleaseMode, ReleasePlatform } from '@shared/contracts/domain';
import type {
  ReleaseLogEntry,
  ReleaseProgressKind,
  ReleaseResult,
} from '@shared/contracts/release';

export type PipelineProgressProps = {
  activePhase: string | null;
  completedPhases: number;
  isCancelling: boolean;
  logs: ReleaseLogEntry[];
  mode: ReleaseMode;
  onCancel: () => void;
  percent: number;
  platform: 'android' | 'ios' | null;
  platforms: ReleasePlatform[];
  progressKind: ReleaseProgressKind;
  result: ReleaseResult | null;
  totalPhases: number;
};
