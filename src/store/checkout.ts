import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartLine } from '@/api';

export interface Draft {
  eventId: string;
  slug: string;
  cart: CartLine[];
  promo?: string;
  password?: string;
  kickback?: string;
  tracking?: string;
  waitlistEntryId?: string;
}

interface CheckoutState {
  draft: Draft | null;
  refs: Record<string, { kickback?: string; tracking?: string; promo?: string }>; // per event, from ?ref= / ?t= / ?promo=
  unlocked: Record<string, { ids: string[]; password: string }>;
  setDraft: (d: Draft | null) => void;
  setRef: (eventId: string, r: { kickback?: string; tracking?: string; promo?: string }) => void;
  unlock: (eventId: string, ids: string[], password: string) => void;
}

export const useCheckout = create<CheckoutState>()(
  persist(
    (set, get) => ({
      draft: null,
      refs: {},
      unlocked: {},
      setDraft: (draft) => set({ draft }),
      setRef: (eventId, r) => set({ refs: { ...get().refs, [eventId]: { ...get().refs[eventId], ...Object.fromEntries(Object.entries(r).filter(([, v]) => v)) } } }),
      unlock: (eventId, ids, password) => set({ unlocked: { ...get().unlocked, [eventId]: { ids, password } } }),
    }),
    { name: 'bpop:checkout', storage: createJSONStorage(() => sessionStorage) },
  ),
);
