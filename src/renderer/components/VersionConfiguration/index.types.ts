import type { ReleasePlatform } from '@shared/contracts/domain';

export type SemanticVersionForm = {
  incrementPatch: boolean;
  major: string;
  minor: string;
  patch: string;
};

export type AndroidReleaseVersionForm = SemanticVersionForm & {
  incrementVersionCode: boolean;
  versionCode: string;
};

export type IosReleaseVersionForm = SemanticVersionForm & {
  buildNumber: string;
  incrementBuildNumber: boolean;
};

export type ReleaseVersionForm = {
  android: AndroidReleaseVersionForm;
  ios: IosReleaseVersionForm;
};

export type VersionConfigurationProps = {
  form: ReleaseVersionForm;
  onChange: (form: ReleaseVersionForm) => void;
  platforms: ReleasePlatform[];
};
