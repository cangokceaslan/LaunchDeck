import { constants } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import { app, dialog, shell, type BrowserWindow, type OpenDialogOptions } from 'electron';
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

const DIRECT_REQUEST_ATTEMPTS_BEFORE_SETTINGS = 2;

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
  private readonly directRequestAttempts = new Map<FileSystemPermissionTarget, number>();
  private isRequestInProgress = false;

  public constructor(private readonly settings: SettingsRepository) {}

  public getState(): FileSystemPermissionState {
    const platform = resolvePlatform();
    const isPermissionRequired = app.isPackaged && platform !== 'unsupported';
    const hasConfirmedAccess =
      !isPermissionRequired || this.settings.hasConfirmedFileSystemAccess();
    const platformTargets = platform === 'unsupported' ? [] : PLATFORM_TARGETS[platform];
    const directRequestTarget = DIRECT_REQUEST_TARGETS[platform];
    const requestAttempts =
      directRequestTarget === undefined
        ? 0
        : (this.directRequestAttempts.get(directRequestTarget) ?? 0);
    return {
      directRequestAttempts: requestAttempts,
      hasConfirmedAccess,
      isPermissionRequired,
      platform,
      settingsTargets:
        isPermissionRequired && requestAttempts >= DIRECT_REQUEST_ATTEMPTS_BEFORE_SETTINGS
          ? platformTargets
          : [],
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
    if (!app.isPackaged) {
      return { outcome: 'accessConfirmed', state: this.getState() };
    }
    const settingsUrl = resolveSettingsUrl(platform, target);
    if (settingsUrl === null) {
      throw new Error('The requested file access setting is unavailable on this platform.');
    }
    const directRequestTarget = DIRECT_REQUEST_TARGETS[platform];
    const requestAttempts = this.directRequestAttempts.get(target) ?? 0;
    const shouldOpenSettings =
      target !== directRequestTarget ||
      requestAttempts >= DIRECT_REQUEST_ATTEMPTS_BEFORE_SETTINGS;
    if (shouldOpenSettings) {
      await shell.openExternal(settingsUrl);
      if (directRequestTarget !== undefined) {
        this.directRequestAttempts.delete(directRequestTarget);
      }
      return { outcome: 'settingsOpened', state: this.getState() };
    }

    this.directRequestAttempts.set(target, requestAttempts + 1);
    if (platform === 'darwin') {
      try {
        const documentsPath = app.getPath('documents');
        await readdir(documentsPath);
        await access(documentsPath, constants.R_OK | constants.W_OK);
      } catch {
        return { outcome: 'requestCancelled', state: this.getState() };
      }
      this.settings.markFileSystemAccessConfirmed();
      this.directRequestAttempts.delete(target);
      return { outcome: 'accessConfirmed', state: this.getState() };
    }

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
    this.directRequestAttempts.delete(target);
    return { outcome: 'accessConfirmed', state: this.getState() };
  }
}
