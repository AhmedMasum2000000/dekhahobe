import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useActiveOrg = create<{ orgId: string | null; set: (id: string | null) => void }>()(
  persist((set) => ({ orgId: null, set: (orgId) => set({ orgId }) }), { name: 'bpop:active-org' }),
);
