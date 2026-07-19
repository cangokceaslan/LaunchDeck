import type {
  AndroidProjectMetadataRequest,
  AndroidProjectMetadataResult,
  ApplicationDetail,
  ApplicationSummary,
  CreateApplicationRequest,
  DeleteApplicationResult,
  IosProjectMetadataRequest,
  IosProjectMetadataResult,
  IosProjectDiscoveryResult,
  IosSchemeListResult,
  PathSelectionResult,
  ThemePreference,
  UpdateArtifactOutputDirectoryRequest,
  UpdateApplicationRequest,
} from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';
import type {
  CancelReleaseResult,
  CreateFastActionRequest,
  DeleteFastActionRequest,
  DeleteFastActionResult,
  FastAction,
  PreflightReleaseRequest,
  PreflightResult,
  ReleaseEvent,
  RunHistorySummary,
  StartReleaseResult,
  UpdateFastActionRequest,
} from '@shared/contracts/release';
import type { AppSettings } from '@shared/contracts/settings';

export type DesktopApi = {
  cancelRelease: (runId: string) => Promise<CancelReleaseResult>;
  chooseAndroidArtifact: () => Promise<PathSelectionResult>;
  chooseAndroidKeystore: () => Promise<PathSelectionResult>;
  chooseAndroidProjectDirectory: () => Promise<PathSelectionResult>;
  chooseArtifactOutputDirectory: () => Promise<PathSelectionResult>;
  chooseGoogleServiceInfoPlist: () => Promise<PathSelectionResult>;
  chooseGoogleServicesJson: () => Promise<PathSelectionResult>;
  chooseGooglePlayServiceAccount: () => Promise<PathSelectionResult>;
  chooseHookDirectory: () => Promise<PathSelectionResult>;
  chooseIosArtifact: () => Promise<PathSelectionResult>;
  chooseIosProjectDirectory: () => Promise<PathSelectionResult>;
  chooseIosWorkspaceOrProject: () => Promise<PathSelectionResult>;
  chooseAppStoreConnectApiKey: () => Promise<PathSelectionResult>;
  chooseServiceAccountFile: () => Promise<PathSelectionResult>;
  clearRunHistory: (applicationId: string) => Promise<void>;
  createApplication: (request: CreateApplicationRequest) => Promise<ApplicationDetail>;
  createFastAction: (request: CreateFastActionRequest) => Promise<FastAction>;
  deleteApplication: (applicationId: string) => Promise<DeleteApplicationResult>;
  deleteFastAction: (request: DeleteFastActionRequest) => Promise<DeleteFastActionResult>;
  getApplication: (applicationId: string) => Promise<ApplicationDetail | null>;
  getSettings: () => Promise<AppSettings>;
  listApplications: () => Promise<ApplicationSummary[]>;
  listFastActions: (applicationId: string) => Promise<FastAction[]>;
  listIosSchemes: (workspaceOrProjectPath: string) => Promise<IosSchemeListResult>;
  listRunHistory: (applicationId: string) => Promise<RunHistorySummary[]>;
  onReleaseEvent: (listener: (event: ReleaseEvent) => void) => () => void;
  preflightRelease: (request: PreflightReleaseRequest) => Promise<PreflightResult>;
  resolveAndroidProjectMetadata: (
    request: AndroidProjectMetadataRequest,
  ) => Promise<AndroidProjectMetadataResult>;
  discoverIosProjectConfiguration: (projectPath: string) => Promise<IosProjectDiscoveryResult>;
  resolveIosProjectMetadata: (
    request: IosProjectMetadataRequest,
  ) => Promise<IosProjectMetadataResult>;
  runDoctor: () => Promise<DoctorReport>;
  startRelease: (planId: string) => Promise<StartReleaseResult>;
  updateApplication: (request: UpdateApplicationRequest) => Promise<ApplicationDetail>;
  updateArtifactOutputDirectory: (
    request: UpdateArtifactOutputDirectoryRequest,
  ) => Promise<ApplicationDetail>;
  updateFastAction: (request: UpdateFastActionRequest) => Promise<FastAction>;
  updateTheme: (theme: ThemePreference) => Promise<AppSettings>;
  windowClose: () => Promise<void>;
  windowMinimize: () => Promise<void>;
  windowToggleMaximize: () => Promise<void>;
};
