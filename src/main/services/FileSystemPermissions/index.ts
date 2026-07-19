import { shell } from 'electron';
import type { SettingsRepository } from '@main/repositories/Settings';
import type {
  FileSystemPermissionPlatform,
  FileSystemPermissionState,
  FileSystemPermissionTarget,
} from '@shared/contracts/permissions';

const SETTINGS_URLS = {
  darwin: {
    filesAndFolders:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders',
    fullDiskAccess:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
  },
  win32: {
    controlledFolders: 'ms-settings:windowsdefender',
    fileSystem: 'ms-settings:privacy-broadfilesystemaccess',
  },
} as const;

const resolvePlatform = (): FileSystemPermissionPlatform =>
  process.platform === 'darwin' || process.platform === 'win32'
    ? process.platform
    : 'unsupported';

const resolveSettingsUrl = (
  platform: FileSystemPermissionPlatform,
  target: FileSystemPermissionTarget,
): string | null => {
  if (platform === 'darwin') {
    return target === 'filesAndFolders' || target === 'fullDiskAccess'
      ? SETTINGS_URLS.darwin[target]
      : null;
  }
  if (platform === 'win32') {
    return target === 'controlledFolders' || target === 'fileSystem'
      ? SETTINGS_URLS.win32[target]
      : null;
  }
  return null;
};

export class FileSystemPermissionService {
  public constructor(private readonly settings: SettingsRepository) {}

  public getState(): FileSystemPermissionState {
    return {
      hasReviewed: this.settings.hasReviewedFileSystemPermissions(),
      platform: resolvePlatform(),
    };
  }

  public async review(target: FileSystemPermissionTarget): Promise<FileSystemPermissionState> {
    const platform = resolvePlatform();
    const settingsUrl = resolveSettingsUrl(platform, target);
    if (settingsUrl === null) {
      throw new Error('The requested file access setting is unavailable on this platform.');
    }
    await shell.openExternal(settingsUrl);
    this.settings.markFileSystemPermissionsReviewed();
    return this.getState();
  }
}
