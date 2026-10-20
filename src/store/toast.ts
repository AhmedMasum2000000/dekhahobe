import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error' | 'sms';
  title: string;
  body?: string;
  from?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>, ms?: number) => void;
  dismiss: (id: number) => void;
}

let n = 0;
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t, ms = 4200) => {
    const id = ++n;
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export const toast = {
  success: (title: string, body?: string) => useToast.getState().push({ kind: 'success', title, body }),
  error: (e: unknown) => useToast.getState().push({ kind: 'error', title: e instanceof Error ? e.message : String(e) }, 5200),
  info: (title: string, body?: string) => useToast.getState().push({ kind: 'info', title, body }),
};
