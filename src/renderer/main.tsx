import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@themes/index.css';
import '@renderer/global.scss';
import { App } from '@renderer/App';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('LaunchDeck renderer root was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
