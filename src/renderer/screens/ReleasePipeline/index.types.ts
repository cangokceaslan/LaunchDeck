import type { ApplicationDetail, ReleasePlatform } from '@shared/contracts/domain';
import type { FastAction, PreflightResult } from '@shared/contracts/release';

export type ReleasePipelineIntent =
  | { kind: 'newRelease' }
  | { kind: 'createFastAction' }
  | { fastAction: FastAction; kind: 'editFastAction' }
  | { fastAction: FastAction; kind: 'runFastAction'; preflight: PreflightResult };

export type ReleasePipelineProps = {
  application: ApplicationDetail;
  intent: ReleasePipelineIntent;
  onApplicationUpdated: (application: ApplicationDetail) => void;
  onClose: () => void;
  onFastActionSaved: (fastAction: FastAction) => void;
  onFinished: () => void;
  supportedPlatforms: ReleasePlatform[];
};
