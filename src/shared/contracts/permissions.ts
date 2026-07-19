export type FileSystemPermissionPlatform = 'darwin' | 'win32' | 'unsupported';

export type FileSystemPermissionTarget =
  | 'controlledFolders'
  | 'fileSystem'
  | 'filesAndFolders'
  | 'fullDiskAccess';

export type FileSystemPermissionState = {
  hasReviewed: boolean;
  platform: FileSystemPermissionPlatform;
};
