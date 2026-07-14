import type { DesktopApi } from '@shared/contracts/desktopApi';

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
