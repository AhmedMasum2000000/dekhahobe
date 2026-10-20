// Pick the backend. `local` runs entirely in the browser (default);
// `supabase` is the drop-in production adapter described in src/api/supabase/README.md.
import type { ApiClient } from './types';
import { localAdapter } from './local/adapter';
import { supabaseAdapter } from './supabase/adapter';

const mode = (import.meta.env.VITE_API_MODE as string | undefined) ?? 'local';

export const api: ApiClient = mode === 'supabase' ? supabaseAdapter : localAdapter;
export { ApiError } from './local/adapter';
export { subscribe, readSession } from './local/db';
export * from './types';
