import path from 'node:path';
import { app, BrowserWindow, dialog } from 'electron';
import { openApplicationDatabase } from '@main/database';
import { FirebaseCliIntegration } from '@main/integrations/FirebaseCli';
import { registerIpcHandlers, removeIpcHandlers } from '@main/ipc/registerHandlers';
import { ApplicationRepository } from '@main/repositories/Application';
import { RunHistoryRepository } from '@main/repositories/RunHistory';
import { SettingsRepository } from '@main/repositories/Settings';
import { AndroidBuilder } from '@main/services/AndroidBuilder';
import { ApplicationService } from '@main/services/Application';
import { CredentialVault } from '@main/services/CredentialVault';
import { DoctorService } from '@main/services/Doctor';
import { IosBuilder } from '@main/services/IosBuilder';
import { ReleaseRunner } from '@main/services/ReleaseRunner';
import { createMainWindow } from '@main/windows/MainWindow';

const bootstrap = async (): Promise<void> => {
  const database = await openApplicationDatabase(app.getPath('userData'));
  const credentialVault = new CredentialVault();
  const applicationRepository = new ApplicationRepository(database, credentialVault);
  const historyRepository = new RunHistoryRepository(database);
  const settingsRepository = new SettingsRepository(database);
  const firebaseCli = new FirebaseCliIntegration();
  const releaseRunner = new ReleaseRunner(
    applicationRepository,
    historyRepository,
    firebaseCli,
    new AndroidBuilder(),
    new IosBuilder(),
    path.join(app.getPath('userData'), 'runs'),
  );
  registerIpcHandlers({
    applicationRepository,
    applicationService: new ApplicationService(applicationRepository),
    doctorService: new DoctorService(firebaseCli),
    historyRepository,
    releaseRunner,
    settingsRepository,
  });
  await createMainWindow({
    hasActiveRun: () => releaseRunner.hasActiveRun(),
    onCancelActiveRun: () => releaseRunner.cancelActive(),
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow({
        hasActiveRun: () => releaseRunner.hasActiveRun(),
        onCancelActiveRun: () => releaseRunner.cancelActive(),
      });
    }
  });
  app.on('before-quit', () => {
    void releaseRunner.cancelActive();
  });
  app.on('will-quit', () => {
    removeIpcHandlers();
    database.close();
  });
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app
    .whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unexpected startup error.';
      dialog.showErrorBox('LaunchDeck could not start', message);
      app.quit();
    });
}

app.on('second-instance', () => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow !== undefined) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
