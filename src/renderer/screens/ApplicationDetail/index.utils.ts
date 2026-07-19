import type { FastActionConfiguration } from '@shared/contracts/release';

type FastActionVersionSummary = {
  counterLabel: 'build' | 'version code';
  counterValue: number;
  platform: 'Android' | 'iOS';
  versionName: string;
};

const resolveTargetVersionName = (versionName: string, shouldIncrementPatch: boolean): string => {
  if (!shouldIncrementPatch) return versionName;
  const components = versionName.split('.');
  const patch = components[2];
  if (components.length !== 3 || patch === undefined) return versionName;
  return `${components[0]}.${components[1]}.${Number(patch) + 1}`;
};

export const resolveFastActionVersionSummaries = (
  configuration: FastActionConfiguration,
): FastActionVersionSummary[] => {
  const summaries: FastActionVersionSummary[] = [];
  const androidVersion = configuration.version?.android;
  if (androidVersion !== undefined) {
    summaries.push({
      counterLabel: 'version code',
      counterValue:
        androidVersion.versionCode + (androidVersion.incrementVersionCode ? 1 : 0),
      platform: 'Android',
      versionName: resolveTargetVersionName(
        androidVersion.versionName,
        androidVersion.incrementPatch,
      ),
    });
  }

  const iosVersion = configuration.version?.ios;
  if (iosVersion !== undefined) {
    summaries.push({
      counterLabel: 'build',
      counterValue: iosVersion.buildNumber + (iosVersion.incrementBuildNumber ? 1 : 0),
      platform: 'iOS',
      versionName: resolveTargetVersionName(iosVersion.versionName, iosVersion.incrementPatch),
    });
  }

  return summaries;
};
