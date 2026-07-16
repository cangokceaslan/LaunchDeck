export type ReleasePlatform = 'android' | 'ios';
export type ReleaseMode = 'buildOnly' | 'uploadOnly' | 'buildAndUpload';
export type AndroidArtifactType = 'apk' | 'aab';
export type HookPhase = 'preBuild' | 'postBuild' | 'preUpload' | 'postUpload';
export type HookPlatform = ReleasePlatform | 'all';
export type ThemePreference = 'light' | 'dark' | 'system';

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
  firebaseAppId: string;
  googleServicesJsonPath: string;
  gradleTask: string;
  projectPath: string;
};

export type IosConfiguration = {
  artifactPath: string;
  configuration: string;
  exportMethod: 'release-testing' | 'enterprise' | 'development';
  firebaseAppId: string;
  googleServiceInfoPlistPath: string;
  projectPath: string;
  scheme: string;
  workspaceOrProjectPath: string;
};

export type AndroidSetupConfiguration = Omit<AndroidConfiguration, 'firebaseAppId'>;
export type IosSetupConfiguration = Omit<IosConfiguration, 'firebaseAppId'>;

export type CreateApplicationRequest = {
  android: AndroidSetupConfiguration | null;
  artifactOutputDirectoryPath: string | null;
  distributionGroups: string[];
  firebaseProjectId: string;
  hooks: PipelineHook[];
  ios: IosSetupConfiguration | null;
  name: string;
  serviceAccountPath: string;
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
  name: string;
  platforms: ReleasePlatform[];
  updatedAt: string;
};

export type ApplicationDetail = ApplicationSummary & {
  android: AndroidConfiguration | null;
  artifactOutputDirectoryPath: string | null;
  distributionGroups: string[];
  hasServiceAccount: boolean;
  hooks: PipelineHook[];
  ios: IosConfiguration | null;
  serviceAccountFileName: string;
};

export type PathSelectionResult =
  | { status: 'cancelled' }
  | { fileName: string; path: string; status: 'selected' };

export type IosSchemeListResult = {
  schemes: string[];
};

export type DeleteApplicationResult = { deleted: boolean };
