import type { ApplicationDetail, ReleasePlatform } from '@shared/contracts/domain';
import type { ReleaseVersionInput, ResolvedReleaseVersion } from '@shared/contracts/release';
import type {
  ReleaseVersionForm,
  SemanticVersionForm,
} from '@components/VersionConfiguration/index.types';
import { isReleaseBuildNumber, isReleaseVersionName } from '@shared/validation';

export const isArtifactSigningConfigured = (
  application: ApplicationDetail,
  platform: ReleasePlatform,
): boolean =>
  platform === 'android'
    ? application.androidSigning?.isConfigured === true
    : application.iosSigning.isEnabled &&
      /^[A-Z0-9]{1,64}$/u.test(application.iosSigning.developmentTeamId);

export const isArtifactSigningRequired = (
  application: ApplicationDetail,
  platform: ReleasePlatform,
): boolean =>
  platform === 'android'
    ? application.artifactGeneration.requiresAndroidSigning
    : application.artifactGeneration.requiresIosSigning;

const resolveIncrementedNumber = (numberText: string, shouldIncrement: boolean): number | null => {
  if (!isReleaseBuildNumber(numberText)) return null;
  const baseNumber = Number(numberText);
  const resolvedNumber = baseNumber + (shouldIncrement ? 1 : 0);
  return isReleaseBuildNumber(String(resolvedNumber)) ? baseNumber : null;
};

const resolveVersionName = (form: SemanticVersionForm): string | null => {
  const baseVersionName = `${form.major}.${form.minor}.${form.patch}`;
  if (!isReleaseVersionName(baseVersionName)) return null;
  const resolvedPatch = Number(form.patch) + (form.incrementPatch ? 1 : 0);
  return isReleaseVersionName(`${form.major}.${form.minor}.${resolvedPatch}`)
    ? baseVersionName
    : null;
};

export const resolveReleaseVersionInput = (
  form: ReleaseVersionForm,
  platforms: ReleasePlatform[],
): ReleaseVersionInput | null => {
  let android: ReleaseVersionInput['android'];
  if (platforms.includes('android')) {
    const versionName = resolveVersionName(form.android);
    const versionCode = resolveIncrementedNumber(
      form.android.versionCode,
      form.android.incrementVersionCode,
    );
    if (versionName === null || versionCode === null) return null;
    android = {
      incrementPatch: form.android.incrementPatch,
      incrementVersionCode: form.android.incrementVersionCode,
      versionCode,
      versionName,
    };
  }

  let ios: ReleaseVersionInput['ios'];
  if (platforms.includes('ios')) {
    const versionName = resolveVersionName(form.ios);
    const buildNumber = resolveIncrementedNumber(
      form.ios.buildNumber,
      form.ios.incrementBuildNumber,
    );
    if (versionName === null || buildNumber === null) return null;
    ios = {
      buildNumber,
      incrementBuildNumber: form.ios.incrementBuildNumber,
      incrementPatch: form.ios.incrementPatch,
      versionName,
    };
  }

  return { android, ios };
};

export const formatResolvedVersion = (version: ResolvedReleaseVersion): string => {
  const platformVersions = [
    version.android === undefined
      ? null
      : `Android ${version.android.versionName} · versionCode ${version.android.versionCode}`,
    version.ios === undefined
      ? null
      : `iOS ${version.ios.versionName} · build ${version.ios.buildNumber}`,
  ].filter((label): label is string => label !== null);
  return platformVersions.join(' · ');
};
