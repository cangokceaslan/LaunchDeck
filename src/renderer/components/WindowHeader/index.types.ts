import type { DoctorReport } from '@shared/contracts/doctor';
import type { ThemePreference } from '@shared/contracts/domain';
import type {
  FileSystemPermissionState,
  FileSystemPermissionTarget,
} from '@shared/contracts/permissions';

export type WindowHeaderProps = {
  doctorError: string | null;
  doctorReport: DoctorReport | null;
  fileSystemPermissionError: string | null;
  fileSystemPermissionState: FileSystemPermissionState | null;
  isCheckingDoctor: boolean;
  onReviewFileSystemPermissions: (target: FileSystemPermissionTarget) => void;
  onRetryDoctor: () => void;
  onThemeChange: (theme: ThemePreference) => void;
  reviewingFileSystemPermissionTarget: FileSystemPermissionTarget | null;
  theme: ThemePreference;
};
