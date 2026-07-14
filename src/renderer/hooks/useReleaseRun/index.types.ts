import type { ReleaseLogEntry, ReleaseResult } from '@shared/contracts/release';

export type ReleaseRunViewState = {
  activePhase: string | null;
  completedPhases: number;
  logs: ReleaseLogEntry[];
  percent: number;
  platform: 'android' | 'ios' | null;
  result: ReleaseResult | null;
  runId: string | null;
  status: 'idle' | 'starting' | 'running' | 'cancelling' | 'finished' | 'failedToStart';
  totalPhases: number;
};

export type UseReleaseRunResult = ReleaseRunViewState & {
  cancel: () => Promise<void>;
  errorMessage: string | null;
  start: (planId: string) => Promise<void>;
};
