export type ReleasePlatform = 'android' | 'ios';
export type ReleaseMode = 'buildOnly' | 'uploadOnly' | 'buildAndUpload';
export type AndroidArtifactType = 'apk' | 'aab';
export type DistributionDestination = 'artifact' | 'firebase' | 'store';
export type HookPhase = 'preBuild' | 'postBuild' | 'preUpload' | 'postUpload';
export type HookPlatform = ReleasePlatform | 'all';
export type ThemePreference = 'light' | 'dark' | 'system';

export type ArtifactGenerationConfiguration = {
  androidArtifactTypes: AndroidArtifactType[];
  isEnabled: boolean;
  isIosIpaEnabled: boolean;
  requiresAndroidSigning: boolean;
  requiresIosSigning: boolean;
};

export type FirebaseDistributionConfiguration = {
  isEnabled: boolean;
  requiresAndroidSigning: boolean;
  requiresIosSigning: boolean;
};

export type AndroidSigningSetupConfiguration = {
  keyAlias: string;
  keyPassword: string;
  keystorePath: string;
  storePassword: string;
};

export type AndroidSigningConfiguration = {
  isConfigured: boolean;
  keyAlias: string;
  keystoreFileName: string;
};

export type IosSigningConfiguration = {
  developmentTeamId: string;
  isEnabled: boolean;
};

export type GooglePlayReleaseStatus = 'draft' | 'completed' | 'inProgress';

export type GooglePlaySetupConfiguration = {
  artifactType: AndroidArtifactType;
  initialTrack: string;
  packageName: string;
  promoteAfterUpload: boolean;
  promotionStatus: GooglePlayReleaseStatus;
  promotionTrack: string;
  releaseNotesLanguage: string;
  rolloutFraction: number | null;
  serviceAccountPath: string;
};

export type GooglePlayConfiguration = Omit<GooglePlaySetupConfiguration, 'serviceAccountPath'> & {
  hasServiceAccount: boolean;
  serviceAccountFileName: string;
};

export type AppStoreConnectSetupConfiguration = {
  apiKeyId: string;
  apiKeyPath: string;
  issuerId: string;
};

export type AppStoreConnectConfiguration = Omit<
  AppStoreConnectSetupConfiguration,
  'apiKeyPath'
> & {
  apiKeyFileName: string;
  hasApiKey: boolean;
};

export type PipelineHook = {
  command: string;
  cwdPath: string;
  id: string;
  isEnabled: boolean;
  name: string;
  phase: HookPhase;
  platform: HookPlatform;
};

export type AndroidConfiguration = {
  aabArtifactPath: string;
  aabGradleTask: string;
  artifactPath: string;
  defaultArtifactType: AndroidArtifactType;
  firebaseAppId: string | null;
  googleServicesJsonPath: string | null;
  gradleTask: string;
  projectPath: string;
};

export type IosConfiguration = {
  artifactPath: string;
  bundleIdentifier: string;
  configuration: string;
  exportMethod: 'release-testing' | 'enterprise' | 'development';
  firebaseAppId: string | null;
  googleServiceInfoPlistPath: string | null;
  projectPath: string;
  scheme: string;
  workspaceOrProjectPath: string;
};

export type AndroidSetupConfiguration = Omit<AndroidConfiguration, 'firebaseAppId'>;
export type IosSetupConfiguration = Omit<IosConfiguration, 'firebaseAppId'>;

export type AndroidProjectMetadataRequest = {
  googleServicesJsonPath: string | null;
  gradleTask: string;
  projectPath: string;
};

export type AndroidProjectMetadataResult = {
  firebaseProjectId: string | null;
  googleServicesJsonPath: string | null;
  packageName: string | null;
};

export type IosProjectDiscoveryResult = {
  firebaseProjectId: string | null;
  googleServiceInfoPlistPath: string | null;
  workspaceOrProjectPath: string | null;
};

export type CreateApplicationRequest = {
  android: AndroidSetupConfiguration | null;
  androidSigning: AndroidSigningSetupConfiguration | null;
  appStoreConnect: AppStoreConnectSetupConfiguration | null;
  artifactGeneration: ArtifactGenerationConfiguration;
  artifactOutputDirectoryPath: string | null;
  distributionGroups: string[];
  firebaseDistribution: FirebaseDistributionConfiguration;
  firebaseProjectId: string;
  googlePlay: GooglePlaySetupConfiguration | null;
  hooks: PipelineHook[];
  ios: IosSetupConfiguration | null;
  iosSigning: IosSigningConfiguration;
  name: string;
  serviceAccountPath: string;
  shouldNotifyWhenFinished: boolean;
};

export type UpdateApplicationRequest = Omit<CreateApplicationRequest, 'serviceAccountPath'> & {
  id: string;
  serviceAccountPath: string | null;
};

export type UpdateArtifactOutputDirectoryRequest = {
  applicationId: string;
  directoryPath: string;
};

export type ApplicationSummary = {
  createdAt: string;
  firebaseProjectId: string;
  id: string;
  lastActivityAt: string;
  name: string;
  platforms: ReleasePlatform[];
  updatedAt: string;
};

export type ApplicationListCursor = {
  id: string;
  lastActivityAt: string;
};

export type ApplicationListRequest = {
  cursor?: ApplicationListCursor;
  pageSize: number;
};

export type ApplicationPage = {
  applications: ApplicationSummary[];
  nextCursor: ApplicationListCursor | null;
};

export type ApplicationDetail = ApplicationSummary & {
  android: AndroidConfiguration | null;
  androidSigning: AndroidSigningConfiguration | null;
  appStoreConnect: AppStoreConnectConfiguration | null;
  artifactGeneration: ArtifactGenerationConfiguration;
  artifactOutputDirectoryPath: string | null;
  distributionGroups: string[];
  firebaseDistribution: FirebaseDistributionConfiguration;
  hasServiceAccount: boolean;
  googlePlay: GooglePlayConfiguration | null;
  hooks: PipelineHook[];
  ios: IosConfiguration | null;
  iosSigning: IosSigningConfiguration;
  serviceAccountFileName: string;
  shouldNotifyWhenFinished: boolean;
};

export type PathSelectionResult =
  | { status: 'cancelled' }
  | { fileName: string; path: string; status: 'selected' };

export type IosSchemeListResult = {
  schemes: string[];
};

export type IosProjectMetadataRequest = {
  configuration: string;
  scheme: string;
  workspaceOrProjectPath: string;
};

export type IosProjectMetadataResult = {
  bundleIdentifier: string;
  developmentTeamId: string;
};

export type DeleteApplicationResult = { deleted: boolean };
