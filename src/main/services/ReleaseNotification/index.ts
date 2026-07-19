import { Notification } from 'electron';
import type { ReleaseCompletionNotification } from '@main/services/ReleaseRunner/index.types';

const OUTCOME_LABELS = {
  cancelled: 'cancelled',
  failed: 'failed',
  partiallySucceeded: 'partially completed',
  succeeded: 'completed successfully',
} as const satisfies Record<ReleaseCompletionNotification['outcome'], string>;

export class ReleaseNotificationService {
  public notify(notification: ReleaseCompletionNotification): void {
    if (!Notification.isSupported()) return;
    const platformLabel = notification.platforms
      .map((platform) => platform === 'android' ? 'Android' : 'iOS')
      .join(' + ');
    new Notification({
      body: `${platformLabel} pipeline ${OUTCOME_LABELS[notification.outcome]}.`,
      title: notification.applicationName,
    }).show();
  }
}
