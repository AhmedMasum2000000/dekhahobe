import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe } from '@/api';

/**
 * Run an async API read and re-run it whenever the local database changes
 * (this tab or another tab), so every screen stays live.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = [], opts: { live?: boolean } = { live: true }) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async () => {
    const my = ++seq.current;
    try {
      const v = await fnRef.current();
      if (my === seq.current) {
        setData(v);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(e as Error);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    run();
    if (opts.live === false) return;
    return subscribe(() => run());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: run, setData };
}
