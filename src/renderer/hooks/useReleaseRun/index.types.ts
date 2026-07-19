import type {
  ReleaseLogEntry,
  ReleaseProgressKind,
  ReleaseResult,
} from '@shared/contracts/release';

export type ReleaseRunViewState = {
  activePhase: string | null;
  completedPhases: number;
  logs: ReleaseLogEntry[];
  percent: number;
  platform: 'android' | 'ios' | null;
  progressKind: ReleaseProgressKind;
  result: ReleaseResult | null;
  runId: string | null;
  status: 'idle' | 'starting' | 'running' | 'cancelling' | 'finished' | 'failedToStart';
  totalPhases: number;
};

export type UseReleaseRunResult = ReleaseRunViewState & {
  cancel: () => Promise<void>;
  errorMessage: string | null;
  reset: () => void;
  start: (planId: string) => Promise<void>;
};
