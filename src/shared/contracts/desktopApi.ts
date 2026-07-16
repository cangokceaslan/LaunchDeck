import type {
  ApplicationDetail,
  ApplicationSummary,
  CreateApplicationRequest,
  DeleteApplicationResult,
  IosSchemeListResult,
  PathSelectionResult,
  ThemePreference,
  UpdateArtifactOutputDirectoryRequest,
  UpdateApplicationRequest,
} from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';
import type {
  CancelReleaseResult,
  PreflightReleaseRequest,
  PreflightResult,
  ReleaseEvent,
  RunHistorySummary,
  StartReleaseResult,
} from '@shared/contracts/release';
import type { AppSettings } from '@shared/contracts/settings';

export type DesktopApi = {
  cancelRelease: (runId: string) => Promise<CancelReleaseResult>;
  chooseAndroidArtifact: () => Promise<PathSelectionResult>;
  chooseAndroidProjectDirectory: () => Promise<PathSelectionResult>;
  chooseArtifactOutputDirectory: () => Promise<PathSelectionResult>;
  chooseGoogleServiceInfoPlist: () => Promise<PathSelectionResult>;
  chooseGoogleServicesJson: () => Promise<PathSelectionResult>;
  chooseHookDirectory: () => Promise<PathSelectionResult>;
  chooseIosArtifact: () => Promise<PathSelectionResult>;
  chooseIosProjectDirectory: () => Promise<PathSelectionResult>;
  chooseIosWorkspaceOrProject: () => Promise<PathSelectionResult>;
  chooseServiceAccountFile: () => Promise<PathSelectionResult>;
  clearRunHistory: (applicationId: string) => Promise<void>;
  createApplication: (request: CreateApplicationRequest) => Promise<ApplicationDetail>;
  deleteApplication: (applicationId: string) => Promise<DeleteApplicationResult>;
  getApplication: (applicationId: string) => Promise<ApplicationDetail | null>;
  getSettings: () => Promise<AppSettings>;
  listApplications: () => Promise<ApplicationSummary[]>;
  listIosSchemes: (workspaceOrProjectPath: string) => Promise<IosSchemeListResult>;
  listRunHistory: (applicationId: string) => Promise<RunHistorySummary[]>;
  onReleaseEvent: (listener: (event: ReleaseEvent) => void) => () => void;
  preflightRelease: (request: PreflightReleaseRequest) => Promise<PreflightResult>;
  runDoctor: () => Promise<DoctorReport>;
  startRelease: (planId: string) => Promise<StartReleaseResult>;
  updateApplication: (request: UpdateApplicationRequest) => Promise<ApplicationDetail>;
  updateArtifactOutputDirectory: (
    request: UpdateArtifactOutputDirectoryRequest,
  ) => Promise<ApplicationDetail>;
  updateTheme: (theme: ThemePreference) => Promise<AppSettings>;
  windowClose: () => Promise<void>;
  windowMinimize: () => Promise<void>;
  windowToggleMaximize: () => Promise<void>;
};
