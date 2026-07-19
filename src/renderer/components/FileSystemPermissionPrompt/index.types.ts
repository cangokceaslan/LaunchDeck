import type {
  FileSystemPermissionPlatform,
  FileSystemPermissionTarget,
} from '@shared/contracts/permissions';

export type FileSystemPermissionPromptProps = {
  directRequestAttempts: number;
  errorMessage: string | null;
  isOpen: boolean;
  isReviewing: boolean;
  onClose: () => void;
  onReview: (target: FileSystemPermissionTarget) => void;
  platform: Exclude<FileSystemPermissionPlatform, 'unsupported'>;
  settingsTargets: FileSystemPermissionTarget[];
};
