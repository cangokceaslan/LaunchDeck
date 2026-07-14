import type { ApplicationDetail, ReleasePlatform } from '@shared/contracts/domain';

export type ReleasePipelineProps = {
  application: ApplicationDetail;
  onClose: () => void;
  onFinished: () => void;
  supportedPlatforms: ReleasePlatform[];
};
