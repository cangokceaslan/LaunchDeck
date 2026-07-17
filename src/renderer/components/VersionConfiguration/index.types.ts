import type { ReleasePlatform } from '@shared/contracts/domain';

export type ReleaseVersionForm = {
  androidVersionCode: string;
  incrementAndroidVersionCode: boolean;
  incrementIosBuildNumber: boolean;
  incrementPatch: boolean;
  iosBuildNumber: string;
  major: string;
  minor: string;
  patch: string;
};

export type VersionConfigurationProps = {
  form: ReleaseVersionForm;
  onChange: (form: ReleaseVersionForm) => void;
  platforms: ReleasePlatform[];
};
