import type { ReleaseMode, ReleasePlatform } from '@shared/contracts/domain';
import type { ReleaseResult } from '@shared/contracts/release';

export const formatDateTime = (isoDate: string): string =>
  new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));

export const formatPlatform = (platform: ReleasePlatform): string =>
  platform === 'android' ? 'Android' : 'iOS';

export const formatMode = (mode: ReleaseMode): string => {
  if (mode === 'buildOnly') return 'Build';
  if (mode === 'uploadOnly') return 'Sadece upload';
  return 'Build + upload';
};

export const formatOutcome = (outcome: ReleaseResult['outcome']): string => {
  if (outcome === 'succeeded') return 'Başarılı';
  if (outcome === 'partiallySucceeded') return 'Kısmen başarılı';
  if (outcome === 'cancelled') return 'İptal edildi';
  return 'Başarısız';
};

export const normalizeErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'Beklenmeyen bir hata oluştu.';
  }
  return error.message.replace(/^Error invoking remote method '[^']+': Error:\s*/u, '');
};
