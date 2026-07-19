import type { ApplicationDetail } from '@shared/contracts/domain';
import type { DoctorCheck, DoctorCheckCode, DoctorReport } from '@shared/contracts/doctor';
import type { FileSystemPermissionState } from '@shared/contracts/permissions';
import type {
  SetupRequirement,
  SetupWorkflowSummary,
} from '@components/SetupGuideModal/index.types';

const hasPassedCheck = (report: DoctorReport | null, code: DoctorCheckCode): boolean =>
  report?.checks.some((check) => check.code === code && check.status === 'passed') === true;

export const resolveGeneralSetupChecks = (report: DoctorReport | null): DoctorCheck[] =>
  report?.checks.filter((check) => check.code !== 'xcode' || report.os === 'darwin') ?? [];

export const isGeneralSetupReady = (
  report: DoctorReport | null,
  permissionState: FileSystemPermissionState | null,
): boolean => {
  if (report === null || permissionState === null) return false;
  const hasConfirmedPermissions =
    !permissionState.isPermissionRequired ||
    permissionState.platform === 'unsupported' ||
    permissionState.hasConfirmedAccess;
  const checks = resolveGeneralSetupChecks(report);
  return (
    hasConfirmedPermissions &&
    checks.length > 0 &&
    checks.every((check) => check.status === 'passed')
  );
};

const applicationRequirement = (application: ApplicationDetail | null): SetupRequirement[] =>
  application === null
    ? [{
        detail: 'Select an existing application or add one before checking its saved release configuration.',
        label: 'Application configuration',
      }]
    : [];

const hasIosSigningConfiguration = (application: ApplicationDetail): boolean =>
  application.iosSigning.isEnabled &&
  /^[A-Z0-9]{1,64}$/u.test(application.iosSigning.developmentTeamId);

const resolveArtifactPlatform = (
  application: ApplicationDetail,
  hasXcode: boolean,
  xcodeRequirement: string,
): { detail: string; isReady: boolean } => {
  const isAndroidReady =
    application.android !== null &&
    application.artifactGeneration.androidArtifactTypes.length > 0 &&
    (
      !application.artifactGeneration.requiresAndroidSigning ||
      application.androidSigning?.isConfigured === true
    );
  const isIosReady =
    application.ios !== null &&
    application.artifactGeneration.isIosIpaEnabled &&
    hasXcode &&
    (!application.artifactGeneration.requiresIosSigning || hasIosSigningConfiguration(application));

  if (isAndroidReady && isIosReady) return { detail: 'Android and iOS builds are configured.', isReady: true };
  if (isAndroidReady) return { detail: 'Android artifact generation is configured.', isReady: true };
  if (isIosReady) return { detail: 'iOS artifact generation is configured.', isReady: true };

  const alternatives: string[] = [];
  if (application.android === null) {
    alternatives.push('add an Android project');
  } else if (application.artifactGeneration.androidArtifactTypes.length === 0) {
    alternatives.push('select an Android artifact type');
  } else if (
    application.artifactGeneration.requiresAndroidSigning &&
    application.androidSigning?.isConfigured !== true
  ) {
    alternatives.push('configure Android signing');
  }

  if (application.ios === null) {
    alternatives.push('add an iOS project');
  } else if (!application.artifactGeneration.isIosIpaEnabled) {
    alternatives.push('enable iOS IPA generation');
  } else if (!hasXcode) {
    alternatives.push(xcodeRequirement);
  } else if (
    application.artifactGeneration.requiresIosSigning &&
    !hasIosSigningConfiguration(application)
  ) {
    alternatives.push('enable iOS signing');
  }

  return {
    detail: `Complete one platform path: ${alternatives.join(' or ')}.`,
    isReady: false,
  };
};

const resolveStorePlatform = (
  application: ApplicationDetail,
  hasXcode: boolean,
  xcodeRequirement: string,
): { detail: string; isReady: boolean } => {
  const isAndroidReady =
    application.android !== null && application.googlePlay?.hasServiceAccount === true;
  const isIosReady =
    application.ios !== null &&
    application.appStoreConnect?.hasApiKey === true &&
    hasIosSigningConfiguration(application) &&
    hasXcode;

  if (isAndroidReady && isIosReady) return { detail: 'Google Play and App Store Connect are configured.', isReady: true };
  if (isAndroidReady) return { detail: 'Google Play distribution is configured.', isReady: true };
  if (isIosReady) return { detail: 'App Store Connect distribution is configured.', isReady: true };

  const alternatives: string[] = [];
  if (application.android === null) {
    alternatives.push('add an Android project and Google Play credentials');
  } else if (application.googlePlay === null) {
    alternatives.push('enable Google Play distribution');
  } else if (!application.googlePlay.hasServiceAccount) {
    alternatives.push('add a Google Play service account');
  }

  if (application.ios === null) {
    alternatives.push('add an iOS project and App Store Connect credentials');
  } else if (application.appStoreConnect === null) {
    alternatives.push('enable App Store Connect distribution');
  } else if (!application.appStoreConnect.hasApiKey) {
    alternatives.push('add an App Store Connect API key');
  } else if (!hasIosSigningConfiguration(application)) {
    alternatives.push('enable iOS signing');
  } else if (!hasXcode) {
    alternatives.push(xcodeRequirement);
  }

  return {
    detail: `Complete one store path: ${alternatives.join(' or ')}.`,
    isReady: false,
  };
};

const resolveFirebasePlatform = (
  application: ApplicationDetail,
): { detail: string; isReady: boolean } => {
  const isAndroidReady = application.android?.firebaseAppId !== null && application.android !== null;
  const isIosReady = application.ios?.firebaseAppId !== null && application.ios !== null;

  if (isAndroidReady && isIosReady) return { detail: 'Android and iOS Firebase app identities are configured.', isReady: true };
  if (isAndroidReady) return { detail: 'The Android Firebase app identity is configured.', isReady: true };
  if (isIosReady) return { detail: 'The iOS Firebase app identity is configured.', isReady: true };

  return {
    detail: 'Add google-services.json for Android or GoogleService-Info.plist for iOS.',
    isReady: false,
  };
};

export const resolveSetupWorkflows = (
  report: DoctorReport | null,
  application: ApplicationDetail | null,
): SetupWorkflowSummary[] => {
  const hasFirebaseCli = hasPassedCheck(report, 'firebaseCli');
  const hasXcode = hasPassedCheck(report, 'xcode');
  const xcodeRequirement = report === null
    ? 'finish the environment check to verify Xcode Command Line Tools'
    : 'install Xcode Command Line Tools';
  const missingApplication = applicationRequirement(application);

  const artifactMissing: SetupRequirement[] = [...missingApplication];
  if (application !== null) {
    if (!application.artifactGeneration.isEnabled) {
      artifactMissing.push({
        detail: 'Enable Artifact generation in the application setup.',
        label: 'Artifact destination',
      });
    }
    if (application.artifactOutputDirectoryPath === null) {
      artifactMissing.push({
        detail: 'Choose the folder where generated APK, AAB, or IPA files will be saved.',
        label: 'Local output directory',
      });
    }
    const platform = resolveArtifactPlatform(application, hasXcode, xcodeRequirement);
    if (!platform.isReady) {
      artifactMissing.push({ detail: platform.detail, label: 'Build platform' });
    }
  }

  const storeMissing: SetupRequirement[] = [...missingApplication];
  if (application !== null) {
    const platform = resolveStorePlatform(application, hasXcode, xcodeRequirement);
    if (!platform.isReady) {
      storeMissing.push({ detail: platform.detail, label: 'Store connection' });
    }
  }

  const firebaseMissing: SetupRequirement[] = [...missingApplication];
  if (!hasFirebaseCli) {
    firebaseMissing.push({
      detail: report === null
        ? 'Finish the environment check to verify that Firebase CLI is available.'
        : 'Install Firebase CLI and make the firebase executable available to LaunchDeck.',
      label: 'Firebase CLI',
    });
  }
  if (application !== null) {
    if (!application.firebaseDistribution.isEnabled) {
      firebaseMissing.push({
        detail: 'Enable Firebase App Distribution in the application setup.',
        label: 'Firebase destination',
      });
    }
    if (!application.hasServiceAccount) {
      firebaseMissing.push({
        detail: 'Add a Firebase service-account JSON file in the application setup.',
        label: 'Firebase credentials',
      });
    }
    if (application.firebaseProjectId.trim() === '') {
      firebaseMissing.push({
        detail: 'Set the Firebase Project ID that matches the service account.',
        label: 'Firebase Project ID',
      });
    }
    if (application.distributionGroups.length === 0) {
      firebaseMissing.push({
        detail: 'Add at least one Firebase tester-group alias.',
        label: 'Tester groups',
      });
    }
    const platform = resolveFirebasePlatform(application);
    if (!platform.isReady) {
      firebaseMissing.push({ detail: platform.detail, label: 'Firebase app identity' });
    }
  }

  return [
    {
      description: 'Build and save an APK, AAB, or IPA locally.',
      id: 'artifact',
      isReady: artifactMissing.length === 0,
      missingRequirements: artifactMissing,
      readyDetail: application === null
        ? ''
        : resolveArtifactPlatform(application, hasXcode, xcodeRequirement).detail,
      title: 'Generate Artifact',
    },
    {
      description: 'Send a release to Google Play or App Store Connect.',
      id: 'store',
      isReady: storeMissing.length === 0,
      missingRequirements: storeMissing,
      readyDetail: application === null
        ? ''
        : resolveStorePlatform(application, hasXcode, xcodeRequirement).detail,
      title: 'Store Distribution',
    },
    {
      description: 'Upload a release to Firebase tester groups.',
      id: 'firebase',
      isReady: firebaseMissing.length === 0,
      missingRequirements: firebaseMissing,
      readyDetail: application === null ? '' : resolveFirebasePlatform(application).detail,
      title: 'Firebase App Distribution',
    },
  ];
};
