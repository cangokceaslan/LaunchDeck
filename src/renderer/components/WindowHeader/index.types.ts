import type { ApplicationDetail } from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';
import type {
  FileSystemPermissionState,
  FileSystemPermissionTarget,
} from '@shared/contracts/permissions';

export type WindowHeaderProps = {
  application: ApplicationDetail | null;
  doctorError: string | null;
  doctorReport: DoctorReport | null;
  fileSystemPermissionError: string | null;
  fileSystemPermissionState: FileSystemPermissionState | null;
  isCheckingDoctor: boolean;
  onReviewFileSystemPermissions: (target: FileSystemPermissionTarget) => void;
  onRetryDoctor: () => void;
  reviewingFileSystemPermissionTarget: FileSystemPermissionTarget | null;
};
