import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@themes/index.css';
import '@renderer/global.scss';
import { ScreenshotApp } from '@screenshots/ScreenshotApp';
import '@screenshots/styles.scss';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('LaunchDeck screenshot renderer root was not found.');
}

document.documentElement.dataset.theme = 'light';
document.documentElement.dataset.bsTheme = 'light';

Object.defineProperty(window, 'desktopApi', {
  configurable: false,
  value: {
    onReleaseEvent: () => (): void => undefined,
  },
  writable: false,
});

createRoot(rootElement).render(
  <StrictMode>
    <ScreenshotApp />
  </StrictMode>,
);
