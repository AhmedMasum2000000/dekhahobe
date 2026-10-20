import { Component, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { PopStar } from './ui';

// A failed render used to unmount the whole app and leave a blank white page.
// This boundary keeps the shell recoverable: a missing code chunk (the site was
// redeployed while the tab was open) reloads once; anything else shows a retry screen.

const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i;
const RELOAD_KEY = 'bpop:reloaded-at';

declare global {
  interface Window {
    /** Set by the boot guard in index.html: reloads a fresh copy, at most once every 30 s. */
    __bpopFreshReload?: () => boolean;
  }
}

/** Load the current version once; returns false if we just did and it didn't help. */
export function reloadOnce(): boolean {
  if (window.__bpopFreshReload) return window.__bpopFreshReload();
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked: still try a single reload */
  }
  window.location.reload();
  return true;
}

interface State {
  error: Error | null;
  reloading: boolean;
}

class Boundary extends Component<{ children: ReactNode; resetKey: string }, State> {
  state: State = { error: null, reloading: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, reloading: false };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    // navigating away from a broken page clears the error without remounting the app
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, reloading: false });
  }

  componentDidCatch(error: Error) {
    console.error('B-POP TAGS: page failed to render', error);
    if (CHUNK_ERROR.test(error.message) && reloadOnce()) this.setState({ reloading: true });
  }

  render() {
    const { error, reloading } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center" data-testid="page-error">
        <PopStar className="h-14 w-14" />
        <h1 className="headline mt-4 text-5xl">{reloading ? 'Updating…' : 'This page hit a snag'}</h1>
        <p className="mt-3 max-w-md text-ink-3">
          {reloading ? 'A newer version of B-POP TAGS is out. Loading it now.' : 'Reload to try again. Your tickets and account are safe.'}
        </p>
        {!reloading && (
          <>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button className="btn btn-brand btn-lg" onClick={() => reloadOnce() || window.location.reload()}>Reload</button>
              <a href="#/" className="btn btn-outline btn-lg">Go home</a>
            </div>
            <p className="mt-6 max-w-md break-words font-mono text-xs text-ink-4">{error.message}</p>
          </>
        )}
      </div>
    );
  }
}

/** Catches render errors for the current route; leaving the route clears them. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
