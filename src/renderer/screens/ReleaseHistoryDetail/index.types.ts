import type { RunHistorySummary } from '@shared/contracts/release';

export type ReleaseHistoryDetailProps = {
  applicationName: string;
  onBack: () => void;
  onRepeat: (run: RunHistorySummary) => void;
  run: RunHistorySummary;
};
