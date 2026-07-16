import type { ApplicationDetail, ReleasePlatform } from '@shared/contracts/domain';

export type ReleasePipelineProps = {
  application: ApplicationDetail;
  onApplicationUpdated: (application: ApplicationDetail) => void;
  onClose: () => void;
  onFinished: () => void;
  supportedPlatforms: ReleasePlatform[];
};
