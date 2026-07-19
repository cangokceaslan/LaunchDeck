import type { DistributionDestination } from '@shared/contracts/domain';
import type { ReleaseResult } from '@shared/contracts/release';
import type { StatusPillProps } from '@components/StatusPill/index.types';

export const formatHistoryDestination = (destination: DistributionDestination): string =>
  destination === 'artifact'
    ? 'Artifact'
    : destination === 'firebase'
      ? 'Firebase'
      : 'Store';

export const formatRunDuration = (startedAt: string, finishedAt: string): string => {
  const durationMilliseconds = Math.max(
    0,
    new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
  );
  if (!Number.isFinite(durationMilliseconds)) return 'Unknown duration';
  const seconds = Math.max(1, Math.round(durationMilliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
};

export const getHistoryActionLabel = (outcome: ReleaseResult['outcome']): 'Repeat' | 'Retry' =>
  outcome === 'failed' || outcome === 'partiallySucceeded' ? 'Retry' : 'Repeat';

export const getHistoryOutcomeTone = (
  outcome: ReleaseResult['outcome'],
): StatusPillProps['tone'] => {
  if (outcome === 'succeeded') return 'success';
  if (outcome === 'partiallySucceeded') return 'warning';
  if (outcome === 'cancelled') return 'neutral';
  return 'danger';
};
