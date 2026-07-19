import type { ApplicationDetail } from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';
import type {
  FileSystemPermissionState,
  FileSystemPermissionTarget,
} from '@shared/contracts/permissions';

export type WindowFrameProps = {
  application: ApplicationDetail | null;
  children: React.ReactNode;
  doctorError: string | null;
  doctorReport: DoctorReport | null;
  fileSystemPermissionError: string | null;
  fileSystemPermissionState: FileSystemPermissionState | null;
  isCheckingDoctor: boolean;
  onReviewFileSystemPermissions: (target: FileSystemPermissionTarget) => void;
  onRetryDoctor: () => void;
  reviewingFileSystemPermissionTarget: FileSystemPermissionTarget | null;
};
