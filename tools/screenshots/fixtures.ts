import type { DoctorReport } from '@shared/contracts/doctor';
import type { FileSystemPermissionState } from '@shared/contracts/permissions';
import type {
  ApplicationDetail,
  ApplicationSummary,
} from '@shared/contracts/domain';
import type {
  FastAction,
  ReleaseLogEntry,
  ReleaseResult,
  RunHistorySummary,
} from '@shared/contracts/release';

const applicationId = 'fixture-northstar-mobile';
const startedAt = '2026-07-20T09:30:00.000Z';
const finishedAt = '2026-07-20T09:36:42.000Z';

export const application: ApplicationDetail = {
  android: {
    aabArtifactPath: 'app/build/outputs/bundle/release/app-release.aab',
    aabGradleTask: ':app:bundleRelease',
    artifactPath: 'app/build/outputs/apk/release/app-release.apk',
    defaultArtifactType: 'aab',
    firebaseAppId: '1:000000000000:android:fixture0000000000',
    googleServicesJsonPath: '/workspace/northstar-mobile/android/app/google-services.json',
    gradleTask: ':app:assembleRelease',
    projectPath: '/workspace/northstar-mobile/android',
  },
  androidSigning: {
    isConfigured: true,
    keyAlias: 'northstar-upload',
    keystoreFileName: 'northstar-upload.jks',
  },
  appStoreConnect: {
    apiKeyFileName: 'AuthKey_FIXTURE01.p8',
    apiKeyId: 'FIXTURE01',
    hasApiKey: true,
    issuerId: '00000000-0000-0000-0000-000000000000',
  },
  artifactGeneration: {
    androidArtifactTypes: ['apk', 'aab'],
    isEnabled: true,
    isIosIpaEnabled: true,
    requiresAndroidSigning: true,
    requiresIosSigning: true,
  },
  artifactOutputDirectoryPath: '/workspace/northstar-mobile/releases',
  createdAt: '2026-07-01T08:00:00.000Z',
  distributionGroups: ['qa-team', 'product-reviewers'],
  firebaseDistribution: {
    isEnabled: true,
    requiresAndroidSigning: true,
    requiresIosSigning: true,
  },
  firebaseProjectId: 'northstar-fixture-project',
  googlePlay: {
    artifactType: 'aab',
    hasServiceAccount: true,
    initialTrack: 'qa',
    packageName: 'com.example.northstar',
    promoteAfterUpload: true,
    promotionStatus: 'draft',
    promotionTrack: 'production',
    releaseNotesLanguage: 'en-US',
    rolloutFraction: null,
    serviceAccountFileName: 'google-play-publisher.fixture.json',
  },
  hasServiceAccount: true,
  hooks: [
    {
      command: 'npm run prepare-release',
      cwdPath: '/workspace/northstar-mobile',
      id: 'fixture-hook-prepare',
      isEnabled: true,
      name: 'Prepare release assets',
      phase: 'preBuild',
      platform: 'all',
    },
  ],
  iconDataUrl: null,
  id: applicationId,
  ios: {
    artifactPath: 'release/Northstar.ipa',
    bundleIdentifier: 'com.example.northstar',
    configuration: 'Release',
    exportMethod: 'release-testing',
    firebaseAppId: '1:000000000000:ios:fixture0000000000',
    googleServiceInfoPlistPath: '/workspace/northstar-mobile/ios/GoogleService-Info.plist',
    projectPath: '/workspace/northstar-mobile/ios',
    scheme: 'Northstar',
    workspaceOrProjectPath: '/workspace/northstar-mobile/ios/Northstar.xcworkspace',
  },
  iosSigning: {
    developmentTeamId: 'AB12CD34EF',
    isEnabled: true,
  },
  lastActivityAt: finishedAt,
  name: 'Northstar Mobile',
  platforms: ['android', 'ios'],
  serviceAccountFileName: 'firebase-app-distribution.fixture.json',
  shouldNotifyWhenFinished: true,
  updatedAt: finishedAt,
};

export const applicationSummary: ApplicationSummary = {
  createdAt: application.createdAt,
  firebaseProjectId: application.firebaseProjectId,
  iconDataUrl: application.iconDataUrl,
  id: application.id,
  lastActivityAt: application.lastActivityAt,
  name: application.name,
  platforms: application.platforms,
  updatedAt: application.updatedAt,
};

export const doctorReport: DoctorReport = {
  checks: [
    {
      code: 'firebaseCli',
      detail: 'Ready: /usr/local/bin/firebase',
      isBlocking: false,
      label: 'Firebase CLI',
      status: 'passed',
      version: '15.1.0',
    },
    {
      code: 'java',
      detail: 'Java and Android signing tools are ready: /usr/bin/java',
      isBlocking: false,
      label: 'Java / JDK',
      status: 'passed',
      version: '25',
    },
    {
      code: 'androidSdk',
      detail: 'Android SDK build-tools are available: /workspace/android-sdk',
      isBlocking: false,
      label: 'Android SDK',
      status: 'passed',
    },
    {
      code: 'platform',
      detail: 'Android and iOS release workflows are available on macOS.',
      isBlocking: false,
      label: 'Platform support',
      status: 'passed',
    },
    {
      code: 'xcode',
      detail: 'iOS build tool ready: /usr/bin/xcodebuild',
      isBlocking: false,
      label: 'Xcode',
      status: 'passed',
      version: '26.4',
    },
  ],
  isReady: true,
  os: 'darwin',
  supportedPlatforms: ['android', 'ios'],
};

export const permissionState: FileSystemPermissionState = {
  directRequestAttempts: 2,
  hasConfirmedAccess: true,
  isPermissionRequired: true,
  platform: 'darwin',
  settingsTargets: ['filesAndFolders', 'fullDiskAccess'],
};

export const fastAction: FastAction = {
  applicationId,
  configuration: {
    androidArtifactType: 'aab',
    artifactSigningPlatforms: ['android', 'ios'],
    destinations: ['firebase', 'store'],
    distributionGroups: ['qa-team', 'product-reviewers'],
    mode: 'buildAndUpload',
    platforms: ['android', 'ios'],
    releaseNotes: 'Northstar fixture release for documentation.',
    version: {
      android: {
        incrementPatch: true,
        incrementVersionCode: true,
        versionCode: 140,
        versionName: '2.4.0',
      },
      ios: {
        buildNumber: 140,
        incrementBuildNumber: true,
        incrementPatch: true,
        versionName: '2.4.0',
      },
    },
  },
  createdAt: '2026-07-18T10:00:00.000Z',
  id: 'fixture-fast-action',
  name: 'QA and store candidate',
  updatedAt: '2026-07-19T10:00:00.000Z',
};

export const releaseResult: ReleaseResult = {
  applicationId,
  finishedAt,
  mode: 'buildAndUpload',
  outcome: 'succeeded',
  platforms: [
    {
      buildStatus: 'succeeded',
      firebaseStatus: 'succeeded',
      platform: 'android',
      storeStatus: 'succeeded',
      uploadStatus: 'succeeded',
    },
    {
      buildStatus: 'succeeded',
      firebaseStatus: 'succeeded',
      platform: 'ios',
      storeStatus: 'succeeded',
      uploadStatus: 'succeeded',
    },
  ],
  runId: 'fixture-run-2026-07-20',
  startedAt,
};

export const runHistory: RunHistorySummary = {
  applicationId,
  configuration: fastAction.configuration,
  finishedAt,
  id: releaseResult.runId,
  mode: releaseResult.mode,
  outcome: releaseResult.outcome,
  platforms: ['android', 'ios'],
  result: releaseResult,
  startedAt,
};

export const releaseLogs: ReleaseLogEntry[] = [
  {
    level: 'info',
    message: 'Validated the immutable release plan.',
    phase: 'validating',
    sequence: 1,
    timestamp: '2026-07-20T09:30:04.000Z',
  },
  {
    level: 'info',
    message: 'Android bundle signed and verified.',
    phase: 'verifying',
    platform: 'android',
    sequence: 2,
    timestamp: '2026-07-20T09:33:18.000Z',
  },
  {
    level: 'info',
    message: 'Uploading verified artifacts to configured destinations.',
    phase: 'upload',
    platform: 'ios',
    sequence: 3,
    timestamp: '2026-07-20T09:34:02.000Z',
  },
];
