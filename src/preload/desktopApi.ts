import { ipcRenderer } from 'electron';
import type { DesktopApi } from '@shared/contracts/desktopApi';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import type { ReleaseEvent } from '@shared/contracts/release';

export const desktopApi: DesktopApi = {
  cancelRelease: (runId) => ipcRenderer.invoke(IPC_CHANNELS.releaseCancel, runId),
  chooseAndroidArtifact: () => ipcRenderer.invoke(IPC_CHANNELS.pathChooseAndroidArtifact),
  chooseAndroidKeystore: () => ipcRenderer.invoke(IPC_CHANNELS.pathChooseAndroidKeystore),
  chooseAndroidProjectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.pathChooseAndroidProject),
  chooseArtifactOutputDirectory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.pathChooseArtifactOutputDirectory),
  chooseGoogleServiceInfoPlist: () =>
    ipcRenderer.invoke(IPC_CHANNELS.pathChooseGoogleServiceInfoPlist),
  chooseGoogleServicesJson: () => ipcRenderer.invoke(IPC_CHANNELS.pathChooseGoogleServicesJson),
  chooseGooglePlayServiceAccount: () =>
    ipcRenderer.invoke(IPC_CHANNELS.pathChooseGooglePlayServiceAccount),
  chooseHookDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.pathChooseHookDirectory),
  chooseIosArtifact: () => ipcRenderer.invoke(IPC_CHANNELS.pathChooseIosArtifact),
  chooseIosProjectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.pathChooseIosProject),
  chooseIosWorkspaceOrProject: () =>
    ipcRenderer.invoke(IPC_CHANNELS.pathChooseIosWorkspaceOrProject),
  chooseAppStoreConnectApiKey: () =>
    ipcRenderer.invoke(IPC_CHANNELS.pathChooseAppStoreConnectApiKey),
  chooseServiceAccountFile: () => ipcRenderer.invoke(IPC_CHANNELS.pathChooseServiceAccount),
  clearRunHistory: (applicationId) => ipcRenderer.invoke(IPC_CHANNELS.historyClear, applicationId),
  createApplication: (request) => ipcRenderer.invoke(IPC_CHANNELS.applicationCreate, request),
  deleteApplication: (applicationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.applicationDelete, applicationId),
  getApplication: (applicationId) => ipcRenderer.invoke(IPC_CHANNELS.applicationGet, applicationId),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  listApplications: () => ipcRenderer.invoke(IPC_CHANNELS.applicationList),
  listIosSchemes: (workspaceOrProjectPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.iosSchemeList, workspaceOrProjectPath),
  listRunHistory: (applicationId) => ipcRenderer.invoke(IPC_CHANNELS.historyList, applicationId),
  onReleaseEvent: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, releaseEvent: ReleaseEvent): void => {
      listener(releaseEvent);
    };
    ipcRenderer.on(IPC_CHANNELS.releaseEvent, wrappedListener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.releaseEvent, wrappedListener);
  },
  preflightRelease: (request) => ipcRenderer.invoke(IPC_CHANNELS.releasePreflight, request),
  resolveAndroidProjectMetadata: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.androidProjectMetadataResolve, request),
  resolveIosProjectMetadata: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.iosProjectMetadataResolve, request),
  runDoctor: () => ipcRenderer.invoke(IPC_CHANNELS.doctorRun),
  startRelease: (planId) => ipcRenderer.invoke(IPC_CHANNELS.releaseStart, planId),
  updateApplication: (request) => ipcRenderer.invoke(IPC_CHANNELS.applicationUpdate, request),
  updateArtifactOutputDirectory: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.applicationUpdateArtifactOutputDirectory, request),
  updateTheme: (theme) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdateTheme, theme),
  windowClose: () => ipcRenderer.invoke(IPC_CHANNELS.windowClose),
  windowMinimize: () => ipcRenderer.invoke(IPC_CHANNELS.windowMinimize),
  windowToggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.windowToggleMaximize),
};
