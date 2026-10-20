// Production adapter placeholder. Implement each ApiClient method against
// Supabase (see README.md in this folder and supabase/migrations/0001_init.sql),
// then build with VITE_API_MODE=supabase.
import type { ApiClient } from '../types';

export const supabaseAdapter = new Proxy({} as ApiClient, {
  get(_t, prop) {
    return () => Promise.reject(new Error(`supabaseAdapter.${String(prop)} is not implemented yet — see src/api/supabase/README.md`));
  },
});
