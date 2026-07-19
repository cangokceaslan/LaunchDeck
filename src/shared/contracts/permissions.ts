export type FileSystemPermissionPlatform = 'darwin' | 'win32' | 'unsupported';

export type FileSystemPermissionTarget =
  | 'controlledFolders'
  | 'fileSystem'
  | 'filesAndFolders'
  | 'fullDiskAccess';

export type FileSystemPermissionState = {
  directRequestAttempts: number;
  hasConfirmedAccess: boolean;
  platform: FileSystemPermissionPlatform;
  settingsTargets: FileSystemPermissionTarget[];
};

export type FileSystemPermissionRequestResult = {
  outcome: 'accessConfirmed' | 'requestCancelled' | 'settingsOpened';
  state: FileSystemPermissionState;
};
