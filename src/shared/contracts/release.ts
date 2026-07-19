import type {
  AndroidArtifactType,
  DistributionDestination,
  ReleaseMode,
  ReleasePlatform,
} from '@shared/contracts/domain';

export type ReleasePhase =
  | 'validating'
  | 'versioning'
  | 'preBuild'
  | 'build'
  | 'postBuild'
  | 'preUpload'
  | 'upload'
  | 'storeUpload'
  | 'postUpload'
  | 'saving'
  | 'verifying';

export type ReleaseProgressKind = 'estimated' | 'reported' | 'verified';

export type ValidationIssueCode =
  | 'applicationNotFound'
  | 'artifactMissing'
  | 'credentialUnavailable'
  | 'firebaseAccessDenied'
  | 'firebaseCliMissing'
  | 'invalidConfiguration'
  | 'outputDirectoryUnavailable'
  | 'pathMissing'
  | 'platformUnsupported'
  | 'toolMissing';

export type ValidationIssue = {
  code: ValidationIssueCode;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

export type AndroidReleaseVersionInput = {
  incrementVersionCode: boolean;
  incrementPatch: boolean;
  versionCode: number;
  versionName: string;
};

export type IosReleaseVersionInput = {
  buildNumber: number;
  incrementBuildNumber: boolean;
  incrementPatch: boolean;
  versionName: string;
};

export type ReleaseVersionInput = {
  android?: AndroidReleaseVersionInput;
  ios?: IosReleaseVersionInput;
};

export type ResolvedAndroidReleaseVersion = {
  versionCode: number;
  versionName: string;
};

export type ResolvedIosReleaseVersion = {
  buildNumber: number;
  versionName: string;
};

export type ResolvedReleaseVersion = {
  android?: ResolvedAndroidReleaseVersion;
  ios?: ResolvedIosReleaseVersion;
};

export type PreflightReleaseRequest = {
  androidArtifactType?: AndroidArtifactType;
  androidArtifactPath?: string;
  applicationId: string;
  artifactSigningPlatforms: ReleasePlatform[];
  artifactOutputDirectoryPath?: string;
  distributionGroups: string[];
  destinations: DistributionDestination[];
  iosArtifactPath?: string;
  mode: ReleaseMode;
  platforms: ReleasePlatform[];
  releaseNotes: string;
  version?: ReleaseVersionInput;
};

export type FastActionConfiguration = Omit<PreflightReleaseRequest, 'applicationId'>;

export type FastAction = {
  applicationId: string;
  configuration: FastActionConfiguration;
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
};

export type CreateFastActionRequest = {
  applicationId: string;
  configuration: FastActionConfiguration;
  name: string;
};

export type UpdateFastActionRequest = CreateFastActionRequest & { id: string };

export type DeleteFastActionRequest = {
  applicationId: string;
  id: string;
};

export type DeleteFastActionResult = { deleted: boolean };

export type ResolvedReleasePlan = {
  androidArtifactType?: AndroidArtifactType;
  applicationId: string;
  applicationName: string;
  artifactOutputDirectoryPath?: string;
  distributionGroups: string[];
  destinations: DistributionDestination[];
  expiresAt: string;
  mode: ReleaseMode;
  phaseCount: number;
  planId: string;
  platforms: ReleasePlatform[];
  releaseNotes: string;
  signingPlatforms: ReleasePlatform[];
  version?: ResolvedReleaseVersion;
};

export type PreflightResult =
  | { isValid: false; issues: ValidationIssue[] }
  | { isValid: true; plan: ResolvedReleasePlan; warnings: ValidationIssue[] };

export type StartReleaseResult =
  | { runId: string; started: true }
  | { error: SerializedAppError; started: false };

export type CancelReleaseResult = { cancelled: boolean; runId: string };

export type ReleaseLogEntry = {
  level: 'info' | 'warning' | 'error';
  message: string;
  phase: ReleasePhase;
  platform?: ReleasePlatform;
  sequence: number;
  timestamp: string;
};

export type PlatformReleaseResult = {
  artifactPath?: string;
  buildStatus: 'notRequested' | 'succeeded' | 'failed';
  firebaseStatus: 'notRequested' | 'succeeded' | 'failed';
  errorMessage?: string;
  failedPhase?: ReleasePhase;
  platform: ReleasePlatform;
  storeStatus: 'notRequested' | 'succeeded' | 'failed';
  uploadStatus: 'notRequested' | 'succeeded' | 'failed';
};

export type SerializedAppError = {
  code:
    | 'activeRunExists'
    | 'artifactMissing'
    | 'buildFailed'
    | 'cancelled'
    | 'configurationInvalid'
    | 'firebaseAuthFailed'
    | 'planExpired'
    | 'processFailed'
    | 'unexpected'
    | 'uploadFailed';
  details?: string;
  message: string;
  phase?: ReleasePhase;
  platform?: ReleasePlatform;
  retryable: boolean;
};

export type ReleaseResult = {
  applicationId: string;
  finishedAt: string;
  mode: ReleaseMode;
  outcome: 'succeeded' | 'partiallySucceeded' | 'failed' | 'cancelled';
  platforms: PlatformReleaseResult[];
  runId: string;
  startedAt: string;
};

export type ReleaseEvent =
  | {
      activePhase: ReleasePhase;
      completedPhases: number;
      percent: number;
      platform?: ReleasePlatform;
      progressKind: ReleaseProgressKind;
      runId: string;
      totalPhases: number;
      type: 'phaseChanged';
    }
  | { entry: ReleaseLogEntry; runId: string; type: 'logReceived' }
  | { result: ReleaseResult; runId: string; type: 'releaseFinished' };

export type RunHistorySummary = {
  applicationId: string;
  finishedAt: string;
  id: string;
  mode: ReleaseMode;
  outcome: ReleaseResult['outcome'];
  platforms: ReleasePlatform[];
  startedAt: string;
};
