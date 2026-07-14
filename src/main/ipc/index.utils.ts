import type { IpcMainInvokeEvent } from 'electron';

export const assertTrustedSender = (event: IpcMainInvokeEvent): void => {
  const senderFrame = event.senderFrame;
  if (senderFrame === null || senderFrame !== senderFrame.top) {
    throw new Error('IPC isteği yalnız ana uygulama çerçevesinden gelebilir.');
  }
  const senderUrl = new URL(senderFrame.url);
  const developmentUrl = process.env.ELECTRON_RENDERER_URL;
  if (developmentUrl !== undefined) {
    const expectedUrl = new URL(developmentUrl);
    if (senderUrl.origin !== expectedUrl.origin) {
      throw new Error('IPC isteği beklenmeyen bir kaynaktan geldi.');
    }
    return;
  }
  if (senderUrl.protocol !== 'file:' || !senderUrl.pathname.endsWith('/renderer/index.html')) {
    throw new Error('Paketlenmiş uygulama yalnız yerel renderer kaynağını kabul eder.');
  }
};

export const toSafeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Beklenmeyen bir uygulama hatası oluştu.';
