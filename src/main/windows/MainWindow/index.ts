import path from 'node:path';
import { app, BrowserWindow, dialog, shell } from 'electron';
import type { MainWindowOptions } from '@main/windows/MainWindow/index.types';

const isApprovedExternalUrl = (targetUrl: string): boolean => {
  try {
    const parsedUrl = new URL(targetUrl);
    return (
      parsedUrl.protocol === 'https:' &&
      (parsedUrl.hostname === 'firebase.google.com' || parsedUrl.hostname === 'github.com')
    );
  } catch {
    return false;
  }
};

export const createMainWindow = async (options: MainWindowOptions): Promise<BrowserWindow> => {
  const developmentIconPath = path.join(process.cwd(), 'resources', 'dev-icon.png');
  if (!app.isPackaged && process.platform === 'darwin') {
    app.dock?.setIcon(developmentIconPath);
  }
  const mainWindow = new BrowserWindow({
    backgroundColor: '#F7F8FA',
    height: 820,
    ...(!app.isPackaged && process.platform !== 'darwin' ? { icon: developmentIconPath } : {}),
    minHeight: 680,
    minWidth: 1040,
    show: false,
    title: 'LaunchDeck',
    width: 1280,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isApprovedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl !== mainWindow.webContents.getURL()) {
      event.preventDefault();
    }
  });

  let isClosingAfterConfirmation = false;
  mainWindow.on('close', (event) => {
    if (isClosingAfterConfirmation || !options.hasActiveRun()) {
      return;
    }
    event.preventDefault();
    void dialog
      .showMessageBox(mainWindow, {
        buttons: ['Stay', 'Cancel release and quit'],
        cancelId: 0,
        defaultId: 0,
        detail: 'Quitting will safely terminate active child processes.',
        message: 'A release is currently running.',
        title: 'Confirm quit',
        type: 'warning',
      })
      .then(async ({ response }) => {
        if (response !== 1) {
          return;
        }
        isClosingAfterConfirmation = true;
        await options.onCancelActiveRun();
        mainWindow.close();
      });
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  const developmentUrl = process.env.ELECTRON_RENDERER_URL;
  if (developmentUrl !== undefined) {
    await mainWindow.loadURL(developmentUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return mainWindow;
};
