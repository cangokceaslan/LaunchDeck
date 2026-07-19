import path from 'node:path';
import { BrowserWindow, dialog, ipcMain, type FileFilter } from 'electron';
import type { ApplicationRepository } from '@main/repositories/Application';
import type { RunHistoryRepository } from '@main/repositories/RunHistory';
import type { SettingsRepository } from '@main/repositories/Settings';
import type { ApplicationService } from '@main/services/Application';
import type { DoctorService } from '@main/services/Doctor';
import type { FastActionService } from '@main/services/FastAction';
import type { IosBuilder } from '@main/services/IosBuilder';
import type { ReleaseRunner } from '@main/services/ReleaseRunner';
import { assertTrustedSender, toSafeErrorMessage } from '@main/ipc/index.utils';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import {
  androidProjectMetadataRequestSchema,
  applicationIdSchema,
  createApplicationRequestSchema,
  createFastActionRequestSchema,
  deleteFastActionRequestSchema,
  iosProjectMetadataRequestSchema,
  iosSchemeListRequestSchema,
  planIdSchema,
  preflightReleaseRequestSchema,
  themePreferenceSchema,
  updateArtifactOutputDirectoryRequestSchema,
  updateApplicationRequestSchema,
  updateFastActionRequestSchema,
} from '@shared/validation';
import type { PathSelectionResult } from '@shared/contracts/domain';

type HandlerDependencies = {
  applicationRepository: ApplicationRepository;
  applicationService: ApplicationService;
  doctorService: DoctorService;
  fastActionService: FastActionService;
  historyRepository: RunHistoryRepository;
  iosBuilder: IosBuilder;
  releaseRunner: ReleaseRunner;
  settingsRepository: SettingsRepository;
};

const choosePath = async (
  parentWindow: BrowserWindow | null,
  properties: Array<'openFile' | 'openDirectory'>,
  title: string,
  filters?: FileFilter[],
  defaultPath?: string,
): Promise<PathSelectionResult> => {
  const dialogOptions = {
    defaultPath,
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
  ipcMain.handle(
    IPC_CHANNELS.applicationUpdateArtifactOutputDirectory,
    async (event, payload: unknown) => {
      assertTrustedSender(event);
      try {
        return await dependencies.applicationService.updateArtifactOutputDirectory(
          updateArtifactOutputDirectoryRequestSchema.parse(payload),
        );
      } catch (error) {
        throw new Error(toSafeErrorMessage(error));
      }
    },
  );
  ipcMain.handle(IPC_CHANNELS.applicationDelete, (event, payload: unknown) => {
    assertTrustedSender(event);
    return { deleted: dependencies.applicationRepository.delete(applicationIdSchema.parse(payload)) };
  });

  ipcMain.handle(IPC_CHANNELS.fastActionList, (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return dependencies.fastActionService.list(applicationIdSchema.parse(payload));
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  });
  ipcMain.handle(IPC_CHANNELS.fastActionCreate, async (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return await dependencies.fastActionService.create(
        createFastActionRequestSchema.parse(payload),
      );
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  });
  ipcMain.handle(IPC_CHANNELS.fastActionUpdate, async (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return await dependencies.fastActionService.update(
        updateFastActionRequestSchema.parse(payload),
      );
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  });
  ipcMain.handle(IPC_CHANNELS.fastActionDelete, (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return dependencies.fastActionService.delete(deleteFastActionRequestSchema.parse(payload));
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  });

  ipcMain.handle(IPC_CHANNELS.androidProjectMetadataResolve, async (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return await dependencies.applicationService.resolveAndroidProjectMetadata(
        androidProjectMetadataRequestSchema.parse(payload),
      );
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  });

  ipcMain.handle(IPC_CHANNELS.iosSchemeList, async (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return await dependencies.iosBuilder.listSchemes(iosSchemeListRequestSchema.parse(payload));
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
  });

  ipcMain.handle(IPC_CHANNELS.iosProjectMetadataResolve, async (event, payload: unknown) => {
    assertTrustedSender(event);
    try {
      return await dependencies.iosBuilder.resolveProjectMetadata(
        iosProjectMetadataRequestSchema.parse(payload),
      );
    } catch (error) {
      throw new Error(toSafeErrorMessage(error));
    }
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

  ipcMain.handle(IPC_CHANNELS.windowMinimize, (event) => {
    assertTrustedSender(event);
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle(IPC_CHANNELS.windowToggleMaximize, (event) => {
    assertTrustedSender(event);
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow === null) {
      return;
    }
    if (senderWindow.isMaximized()) {
      senderWindow.unmaximize();
    } else {
      senderWindow.maximize();
    }
  });
  ipcMain.handle(IPC_CHANNELS.windowClose, (event) => {
    assertTrustedSender(event);
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  const registerPicker = (
    channel: string,
    properties: Array<'openFile' | 'openDirectory'>,
    title: string,
    filters?: FileFilter[],
  ): void => {
    ipcMain.handle(channel, async (event) => {
      assertTrustedSender(event);
      const result = await choosePath(
        BrowserWindow.fromWebContents(event.sender),
        properties,
        title,
        filters,
        dependencies.settingsRepository.getLastPickerDirectory(channel) ?? undefined,
      );
      if (result.status === 'selected') {
        const isDirectoryOnly = properties.length === 1 && properties[0] === 'openDirectory';
        dependencies.settingsRepository.updateLastPickerDirectory(
          channel,
          isDirectoryOnly ? result.path : path.dirname(result.path),
        );
      }
      return result;
    });
  };
  registerPicker(
    IPC_CHANNELS.pathChooseServiceAccount,
    ['openFile'],
    'Select Firebase service account JSON',
    [{ extensions: ['json'], name: 'JSON' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseGooglePlayServiceAccount,
    ['openFile'],
    'Select Google Play service account JSON',
    [{ extensions: ['json'], name: 'JSON' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseAndroidKeystore,
    ['openFile'],
    'Select Android signing keystore',
    [{ extensions: ['jks', 'keystore'], name: 'Android keystore' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseAppStoreConnectApiKey,
    ['openFile'],
    'Select App Store Connect API key',
    [{ extensions: ['p8'], name: 'App Store Connect API key' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseGoogleServicesJson,
    ['openFile'],
    'Select google-services.json',
    [{ extensions: ['json'], name: 'JSON' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseGoogleServiceInfoPlist,
    ['openFile'],
    'Select GoogleService-Info.plist',
    [{ extensions: ['plist'], name: 'Property List' }],
  );
  registerPicker(IPC_CHANNELS.pathChooseAndroidProject, ['openDirectory'], 'Select Android project directory');
  registerPicker(
    IPC_CHANNELS.pathChooseArtifactOutputDirectory,
    ['openDirectory'],
    'Select artifact output directory',
  );
  registerPicker(IPC_CHANNELS.pathChooseIosProject, ['openDirectory'], 'Select iOS project directory');
  registerPicker(
    IPC_CHANNELS.pathChooseIosWorkspaceOrProject,
    ['openFile', 'openDirectory'],
    'Select an Xcode workspace or project',
    [{ extensions: ['xcworkspace', 'xcodeproj'], name: 'Xcode Project' }],
  );
  registerPicker(IPC_CHANNELS.pathChooseHookDirectory, ['openDirectory'], 'Select command working directory');
  registerPicker(
    IPC_CHANNELS.pathChooseAndroidArtifact,
    ['openFile'],
    'Select APK or AAB file to upload',
    [{ extensions: ['apk', 'aab'], name: 'Android artifact' }],
  );
  registerPicker(
    IPC_CHANNELS.pathChooseIosArtifact,
    ['openFile'],
    'Select IPA file to upload',
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
