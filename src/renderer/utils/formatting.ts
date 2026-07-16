import type { ReleaseMode, ReleasePlatform } from '@shared/contracts/domain';
import type { ReleaseResult } from '@shared/contracts/release';

export const formatDateTime = (isoDate: string): string =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));

export const formatPlatform = (platform: ReleasePlatform): string =>
  platform === 'android' ? 'Android' : 'iOS';

export const formatMode = (mode: ReleaseMode): string => {
  if (mode === 'buildOnly') return 'Build only';
  if (mode === 'uploadOnly') return 'Upload only';
  return 'Build + upload';
};

export const formatOutcome = (outcome: ReleaseResult['outcome']): string => {
  if (outcome === 'succeeded') return 'Succeeded';
  if (outcome === 'partiallySucceeded') return 'Partially succeeded';
  if (outcome === 'cancelled') return 'Cancelled';
  return 'Failed';
};

export const normalizeErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred.';
  }
  return error.message.replace(/^Error invoking remote method '[^']+': Error:\s*/u, '');
};
