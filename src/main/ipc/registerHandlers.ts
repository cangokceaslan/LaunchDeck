import path from 'node:path';
import { BrowserWindow, dialog, ipcMain, type FileFilter } from 'electron';
import type { ApplicationRepository } from '@main/repositories/Application';
import type { RunHistoryRepository } from '@main/repositories/RunHistory';
import type { SettingsRepository } from '@main/repositories/Settings';
import type { ApplicationService } from '@main/services/Application';
import type { DoctorService } from '@main/services/Doctor';
import type { ReleaseRunner } from '@main/services/ReleaseRunner';
import { assertTrustedSender, toSafeErrorMessage } from '@main/ipc/index.utils';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import {
  applicationIdSchema,
  createApplicationRequestSchema,
  planIdSchema,
  preflightReleaseRequestSchema,
  themePreferenceSchema,
  updateApplicationRequestSchema,
} from '@shared/validation';
import type { PathSelectionResult } from '@shared/contracts/domain';

type HandlerDependencies = {
  applicationRepository: ApplicationRepository;
  applicationService: ApplicationService;
  doctorService: DoctorService;
  historyRepository: RunHistoryRepository;
  releaseRunner: ReleaseRunner;
  settingsRepository: SettingsRepository;
};

const choosePath = async (
  parentWindow: BrowserWindow | null,
  properties: Array<'openFile' | 'openDirectory'>,
  title: string,
  filters?: FileFilter[],
): Promise<PathSelectionResult> => {
  const dialogOptions = {
    filters,
    properties,
    title,
  };
  const result =
    parentWindow === null
      ? await dialog.showOpenDialog(dialogOptions)
      : await dialog.showOpenDialog(parentWindow, dialogOptions);
  const selectedPath = result.filePaths[0];
  if (result.canceled || selectedPath === undefined) {
    return { status: 'cancelled' };
  }
  return { fileName: path.basename(selectedPath), path: selectedPath, status: 'selected' };
};

export const registerIpcHandlers = (dependencies: HandlerDependencies): void => {
  ipcMain.handle(IPC_CHANNELS.doctorRun, async (event) => {
    assertTrustedSender(event);
    return dependencies.doctorService.run();
  });

  ipcMain.handle(IPC_CHANNELS.applicationList, (event) => {
    assertTrustedSender(event);
    return dependencies.applicationRepository.list();
  });
  ipcMain.handle(IPC_CHANNELS.applicationGet, (event, payload: unknown) => {
    assertTrustedSender(event);
    return dependencies.applicationRepository.get(applicationIdSchema.parse(payload));
  });
  ipcMain.handle(IPC_CHANNELS.applicationCreate, async (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return await dependencies.applicationService.create(createApplicationRequestSchema.parse(payload));
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  });
  ipcMain.handle(IPC_CHANNELS.applicationUpdate, async (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return await dependencies.applicationService.update(updateApplicationRequestSchema.parse(payload));
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  });
  ipcMain.handle(IPC_CHANNELS.applicationDelete, (event, payload: unknown) => {
    assertTrustedSender(event);
    return { deleted: dependencies.applicationRepository.delete(applicationIdSchema.parse(payload)) };
  });

  ipcMain.handle(IPC_CHANNELS.historyList, (event, payload: unknown) => {
    assertTrustedSender(event);
    return dependencies.historyRepository.list(applicationIdSchema.parse(payload));
  });
  ipcMain.handle(IPC_CHANNELS.historyClear, (event, payload: unknown) => {
    assertTrustedSender(event);
    dependencies.historyRepository.clear(applicationIdSchema.parse(payload));
  });

  ipcMain.handle(IPC_CHANNELS.settingsGet, (event) => {
    assertTrustedSender(event);
    return dependencies.settingsRepository.get();
  });
  ipcMain.handle(IPC_CHANNELS.settingsUpdateTheme, (event, payload: unknown) => {
    assertTrustedSender(event);
    return dependencies.settingsRepository.updateTheme(themePreferenceSchema.parse(payload));
  });

  ipcMain.handle(IPC_CHANNELS.releasePreflight, async (event, payload: unknown) => {
    assertTrustedSender(event);
    return dependencies.releaseRunner.preflight(preflightReleaseRequestSchema.parse(payload));
  });
  ipcMain.handle(IPC_CHANNELS.releaseStart, (event, payload: unknown) => {
    assertTrustedSender(event);
    const sender = event.sender;
    return dependencies.releaseRunner.start(planIdSchema.parse(payload), (releaseEvent) => {
      if (!sender.isDestroyed()) {
        sender.send(IPC_CHANNELS.releaseEvent, releaseEvent);
      }
    });
  });
  ipcMain.handle(IPC_CHANNELS.releaseCancel, async (event, payload: unknown) => {
    assertTrustedSender(event);
    return dependencies.releaseRunner.cancel(applicationIdSchema.parse(payload));
  });

  const registerPicker = (
    channel: string,
    properties: Array<'openFile' | 'openDirectory'>,
    title: string,
    filters?: FileFilter[],
  ): void => {
    ipcMain.handle(channel, async (event) => {
      assertTrustedSender(event);
      return choosePath(BrowserWindow.fromWebContents(event.sender), properties, title, filters);
    });
  };
  registerPicker(
    IPC_CHANNELS.pathChooseServiceAccount,
    ['openFile'],
    'Firebase Service Account JSON seç',
    [{ extensions: ['json'], name: 'JSON' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseGoogleServicesJson,
    ['openFile'],
    'google-services.json seç',
    [{ extensions: ['json'], name: 'JSON' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseGoogleServiceInfoPlist,
    ['openFile'],
    'GoogleService-Info.plist seç',
    [{ extensions: ['plist'], name: 'Property List' }],
  );
  registerPicker(IPC_CHANNELS.pathChooseAndroidProject, ['openDirectory'], 'Android proje klasörünü seç');
  registerPicker(IPC_CHANNELS.pathChooseIosProject, ['openDirectory'], 'iOS proje klasörünü seç');
  registerPicker(
    IPC_CHANNELS.pathChooseIosWorkspaceOrProject,
    ['openFile', 'openDirectory'],
    'Xcode workspace veya project seç',
    [{ extensions: ['xcworkspace', 'xcodeproj'], name: 'Xcode Projesi' }],
  );
  registerPicker(IPC_CHANNELS.pathChooseHookExecutable, ['openFile'], 'Çalıştırılabilir dosyayı seç');
  registerPicker(IPC_CHANNELS.pathChooseHookDirectory, ['openDirectory'], 'Komut çalışma klasörünü seç');
  registerPicker(
    IPC_CHANNELS.pathChooseAndroidArtifact,
    ['openFile'],
    'Yüklenecek APK dosyasını seç',
    [{ extensions: ['apk'], name: 'Android APK' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseIosArtifact,
    ['openFile'],
    'Yüklenecek IPA dosyasını seç',
    [{ extensions: ['ipa'], name: 'iOS IPA' }],
  );
};

export const removeIpcHandlers = (): void => {
  for (const channel of Object.values(IPC_CHANNELS)) {
    if (channel !== IPC_CHANNELS.releaseEvent) {
      ipcMain.removeHandler(channel);
    }
  }
};
