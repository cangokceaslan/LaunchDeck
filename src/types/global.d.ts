import type { DesktopApi } from '@shared/contracts/desktopApi';

declare global {
  interface Window {
    dataLayer?: unknown[];
    desktopApi: DesktopApi;
  }
}

export {};
