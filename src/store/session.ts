import { create } from 'zustand';
import { api, readSession, subscribe, type User } from '@/api';

interface SessionState {
  user: User | null;
  ready: boolean;
  scannerOrgId: string | null;
  refresh: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  scannerOrgId: null,
  refresh: async () => {
    const user = await api.currentUser();
    set({ user, ready: true, scannerOrgId: readSession().scannerOrgId ?? null });
  },
}));

subscribe(() => void useSession.getState().refresh());
void useSession.getState().refresh();
