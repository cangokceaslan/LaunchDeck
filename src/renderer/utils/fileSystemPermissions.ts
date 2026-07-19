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
        'Review access to protected Desktop, Documents, and Downloads locations used by your projects.',
      isPrimary: true,
      label: 'Files & Folders',
      target: 'filesAndFolders',
    },
    {
      detail:
        'Only review this broader access when a selected protected location remains unavailable.',
      isPrimary: false,
      label: 'Full Disk Access',
      target: 'fullDiskAccess',
    },
  ],
  win32: [
    {
      detail: 'Review whether desktop apps can access the Windows file system.',
      isPrimary: true,
      label: 'File system access',
      target: 'fileSystem',
    },
    {
      detail:
        'If Windows Security blocks artifact writes, allow LaunchDeck through ransomware protection.',
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
