import type { ApplicationDetail } from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';
import type {
  FileSystemPermissionState,
  FileSystemPermissionTarget,
} from '@shared/contracts/permissions';

export type SetupWorkflowId = 'artifact' | 'firebase' | 'store';

export type SetupRequirement = {
  detail: string;
  label: string;
};

export type SetupWorkflowSummary = {
  description: string;
  id: SetupWorkflowId;
  isReady: boolean;
  missingRequirements: SetupRequirement[];
  readyDetail: string;
  title: string;
};

export type SetupGuideModalProps = {
  application: ApplicationDetail | null;
  errorMessage: string | null;
  fileSystemPermissionError: string | null;
  fileSystemPermissionState: FileSystemPermissionState | null;
  isChecking: boolean;
  isOpen: boolean;
  onClose: () => void;
  onReviewFileSystemPermissions: (target: FileSystemPermissionTarget) => void;
  onRetry: () => void;
  report: DoctorReport | null;
  reviewingFileSystemPermissionTarget: FileSystemPermissionTarget | null;
};
