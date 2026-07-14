import type { StoredApplication } from '@main/repositories/Application/index.types';
import type {
  PreflightReleaseRequest,
  ResolvedReleasePlan,
} from '@shared/contracts/release';

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
