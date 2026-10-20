import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { reloadOnce } from './components/ErrorBoundary';

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
