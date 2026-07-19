import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { dialog, shell, type BrowserWindow, type OpenDialogOptions } from 'electron';
import type { SettingsRepository } from '@main/repositories/Settings';
import type {
  FileSystemPermissionPlatform,
  FileSystemPermissionRequestResult,
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

const DIRECT_REQUEST_TARGETS: Partial<
  Record<FileSystemPermissionPlatform, FileSystemPermissionTarget>
> = {
  darwin: 'filesAndFolders',
  win32: 'fileSystem',
};

const PLATFORM_TARGETS: Record<
  Exclude<FileSystemPermissionPlatform, 'unsupported'>,
  FileSystemPermissionTarget[]
> = {
  darwin: ['filesAndFolders', 'fullDiskAccess'],
  win32: ['fileSystem', 'controlledFolders'],
};

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
  private readonly attemptedDirectRequests = new Set<FileSystemPermissionTarget>();
  private isRequestInProgress = false;

  public constructor(private readonly settings: SettingsRepository) {}

  public getState(): FileSystemPermissionState {
    const platform = resolvePlatform();
    const hasConfirmedAccess = this.settings.hasConfirmedFileSystemAccess();
    const platformTargets = platform === 'unsupported' ? [] : PLATFORM_TARGETS[platform];
    const directRequestTarget = DIRECT_REQUEST_TARGETS[platform];
    return {
      hasConfirmedAccess,
      platform,
      settingsTargets: platformTargets.filter(
        (target) =>
          hasConfirmedAccess ||
          target !== directRequestTarget ||
          this.attemptedDirectRequests.has(target),
      ),
    };
  }

  public async request(
    target: FileSystemPermissionTarget,
    owner: BrowserWindow | null,
  ): Promise<FileSystemPermissionRequestResult> {
    if (this.isRequestInProgress) {
      throw new Error('Another file access request is already in progress.');
    }
    this.isRequestInProgress = true;
    try {
      return await this.performRequest(target, owner);
    } finally {
      this.isRequestInProgress = false;
    }
  }

  private async performRequest(
    target: FileSystemPermissionTarget,
    owner: BrowserWindow | null,
  ): Promise<FileSystemPermissionRequestResult> {
    const platform = resolvePlatform();
    const settingsUrl = resolveSettingsUrl(platform, target);
    if (settingsUrl === null) {
      throw new Error('The requested file access setting is unavailable on this platform.');
    }
    const directRequestTarget = DIRECT_REQUEST_TARGETS[platform];
    const shouldOpenSettings =
      target !== directRequestTarget ||
      this.settings.hasConfirmedFileSystemAccess() ||
      this.attemptedDirectRequests.has(target);
    if (shouldOpenSettings) {
      await shell.openExternal(settingsUrl);
      this.attemptedDirectRequests.delete(target);
      return { outcome: 'settingsOpened', state: this.getState() };
    }

    this.attemptedDirectRequests.add(target);
    const options: OpenDialogOptions = {
      buttonLabel: 'Allow access',
      message:
        'Choose a project or artifact folder that LaunchDeck can read from and write to.',
      properties: ['openDirectory'],
      title: 'Allow LaunchDeck file access',
    };
    const selection = owner === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(owner, options);
    if (selection.canceled || selection.filePaths[0] === undefined) {
      return { outcome: 'requestCancelled', state: this.getState() };
    }

    try {
      await access(selection.filePaths[0], constants.R_OK | constants.W_OK);
    } catch {
      throw new Error(
        'LaunchDeck could not read and write the selected folder. Try again to open the relevant system access setting.',
      );
    }
    this.settings.markFileSystemAccessConfirmed();
    this.attemptedDirectRequests.delete(target);
    return { outcome: 'accessConfirmed', state: this.getState() };
  }
}
