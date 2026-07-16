import type { IpcMainInvokeEvent } from 'electron';

export const assertTrustedSender = (event: IpcMainInvokeEvent): void => {
  const senderFrame = event.senderFrame;
  if (senderFrame === null || senderFrame !== senderFrame.top) {
    throw new Error('IPC requests may originate only from the main application frame.');
  }
  const senderUrl = new URL(senderFrame.url);
  const developmentUrl = process.env.ELECTRON_RENDERER_URL;
  if (developmentUrl !== undefined) {
    const expectedUrl = new URL(developmentUrl);
    if (senderUrl.origin !== expectedUrl.origin) {
      throw new Error('The IPC request came from an unexpected source.');
    }
    return;
  }
  if (senderUrl.protocol !== 'file:' || !senderUrl.pathname.endsWith('/renderer/index.html')) {
    throw new Error('The packaged application accepts only its local renderer source.');
  }
};

export const toSafeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected application error occurred.';
