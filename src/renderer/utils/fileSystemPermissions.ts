import type {
  FileSystemPermissionPlatform,
  FileSystemPermissionTarget,
} from '@shared/contracts/permissions';

export type FileSystemPermissionTargetSummary = {
  detail: string;
  isPrimary: boolean;
  label: string;
  target: FileSystemPermissionTarget;
};

const TARGETS: Record<
  Exclude<FileSystemPermissionPlatform, 'unsupported'>,
  FileSystemPermissionTargetSummary[]
> = {
  darwin: [
    {
      detail:
        'Grant Documents access through the native macOS prompt. Other protected locations are requested only when used.',
      isPrimary: true,
      label: 'Protected folder access',
      target: 'filesAndFolders',
    },
    {
      detail:
        'Open this broader macOS setting only when a protected location remains unavailable.',
      isPrimary: false,
      label: 'Full Disk Access',
      target: 'fullDiskAccess',
    },
  ],
  win32: [
    {
      detail:
        'Choose a project or artifact folder to confirm that LaunchDeck can read and write it.',
      isPrimary: true,
      label: 'Project folder access',
      target: 'fileSystem',
    },
    {
      detail:
        'Open Windows Security when ransomware protection continues to block artifact writes.',
      isPrimary: false,
      label: 'Controlled folder access',
      target: 'controlledFolders',
    },
  ],
};

export const getFileSystemPermissionTargets = (
  platform: FileSystemPermissionPlatform,
): FileSystemPermissionTargetSummary[] =>
  platform === 'unsupported' ? [] : TARGETS[platform];

export const getPrimaryFileSystemPermissionTarget = (
  platform: Exclude<FileSystemPermissionPlatform, 'unsupported'>,
): FileSystemPermissionTarget => {
  const primaryTarget = TARGETS[platform].find((target) => target.isPrimary);
  return primaryTarget?.target ?? TARGETS[platform][0].target;
};

export const getFileSystemPermissionPlatformLabel = (
  platform: Exclude<FileSystemPermissionPlatform, 'unsupported'>,
): string => (platform === 'darwin' ? 'macOS' : 'Windows');
