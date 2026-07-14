import type { ApplicationDetail, ReleasePlatform } from '@shared/contracts/domain';

export type ApplicationSetupProps = {
  application: ApplicationDetail | null;
  onCancel: () => void;
  onSaved: (application: ApplicationDetail) => void;
  supportedPlatforms: ReleasePlatform[];
};
