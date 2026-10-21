import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useDiscovery = create<{ recent: string[]; remember: (slug: string) => void }>()(
  persist((set) => ({
    recent: [],
    remember: (slug) => set((state) => ({ recent: [slug, ...state.recent.filter((s) => s !== slug)].slice(0, 6) })),
  }), {
    name: 'dekha:discovery',
    storage: createJSONStorage(() => ({
      getItem: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
      setItem: (key, value) => { try { localStorage.setItem(key, value); } catch { /* History must never interrupt ticketing. */ } },
      removeItem: (key) => { try { localStorage.removeItem(key); } catch { /* Optional history. */ } },
    })),
  }),
);
