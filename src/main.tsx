import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/anton/latin-400.css';
import '@fontsource/noto-sans-bengali/bengali-400.css';
import './index.css';
import './experience.css';
import { reloadOnce } from './components/ErrorBoundary';
import { initializeTheme } from './store/theme';
import { initializeMotion } from './store/motion';

initializeTheme();
initializeMotion();

// A code file from an older deploy is gone: load the current version instead of failing.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnce()) e.preventDefault();
});

// drop the cache-busting ?v= the boot guard may have added
if (/[?&]v=/.test(window.location.search)) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
