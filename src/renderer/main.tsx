import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@themes/index.css';
import '@renderer/global.scss';
import { App } from '@renderer/App';
import { initializeAnalytics } from '@renderer/utils/Analytics';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('LaunchDeck renderer root was not found.');
}

document.documentElement.dataset.theme = 'light';
document.documentElement.dataset.bsTheme = 'light';
initializeAnalytics();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
