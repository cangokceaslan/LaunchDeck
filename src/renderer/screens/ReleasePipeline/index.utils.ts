import type { ReleasePlatform } from '@shared/contracts/domain';
import type { ReleaseVersionInput, ResolvedReleaseVersion } from '@shared/contracts/release';
import type { ReleaseVersionForm } from '@components/VersionConfiguration/index.types';
import { isReleaseBuildNumber, isReleaseVersionName } from '@shared/validation';

const resolveIncrementedNumber = (numberText: string, shouldIncrement: boolean): number | null => {
  if (!isReleaseBuildNumber(numberText)) return null;
  const baseNumber = Number(numberText);
  const resolvedNumber = baseNumber + (shouldIncrement ? 1 : 0);
  return isReleaseBuildNumber(String(resolvedNumber)) ? baseNumber : null;
};

export const resolveReleaseVersionInput = (
  form: ReleaseVersionForm,
  platforms: ReleasePlatform[],
): ReleaseVersionInput | null => {
  const baseVersionName = `${form.major}.${form.minor}.${form.patch}`;
  if (!isReleaseVersionName(baseVersionName)) return null;
  const resolvedPatch = Number(form.patch) + (form.incrementPatch ? 1 : 0);
  if (!isReleaseVersionName(`${form.major}.${form.minor}.${resolvedPatch}`)) return null;

  const androidVersionCode = platforms.includes('android')
    ? resolveIncrementedNumber(form.androidVersionCode, form.incrementAndroidVersionCode)
    : undefined;
  const iosBuildNumber = platforms.includes('ios')
    ? resolveIncrementedNumber(form.iosBuildNumber, form.incrementIosBuildNumber)
    : undefined;
  if (
    (platforms.includes('android') && androidVersionCode === null) ||
    (platforms.includes('ios') && iosBuildNumber === null)
  ) {
    return null;
  }

  return {
    androidVersionCode: androidVersionCode ?? undefined,
    incrementAndroidVersionCode:
      platforms.includes('android') && form.incrementAndroidVersionCode,
    incrementIosBuildNumber: platforms.includes('ios') && form.incrementIosBuildNumber,
    incrementPatch: form.incrementPatch,
    iosBuildNumber: iosBuildNumber ?? undefined,
    versionName: baseVersionName,
  };
};

export const formatResolvedVersion = (version: ResolvedReleaseVersion): string => {
  const platformVersions = [
    version.androidVersionCode === undefined
      ? null
      : `Android versionCode ${version.androidVersionCode}`,
    version.iosBuildNumber === undefined ? null : `iOS build ${version.iosBuildNumber}`,
  ].filter((label): label is string => label !== null);
  return `${version.versionName} · ${platformVersions.join(' · ')}`;
};
