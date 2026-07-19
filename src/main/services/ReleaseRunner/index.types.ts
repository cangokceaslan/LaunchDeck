import type { StoredApplication } from '@main/repositories/Application/index.types';
import type {
  PreflightReleaseRequest,
  ReleaseResult,
  ResolvedReleasePlan,
} from '@shared/contracts/release';
import type { ReleasePlatform } from '@shared/contracts/domain';

export type InternalReleasePlan = {
  application: StoredApplication;
  artifactPaths: Partial<Record<'android' | 'ios', string>>;
  publicPlan: ResolvedReleasePlan;
  request: PreflightReleaseRequest;
};

export type ActiveReleaseRun = {
  abortController: AbortController;
  runId: string;
};

export type ReleaseCompletionNotification = {
  applicationName: string;
  outcome: ReleaseResult['outcome'];
  platforms: ReleasePlatform[];
};

export type ReleaseCompletionNotifier = (
  notification: ReleaseCompletionNotification,
) => void;
