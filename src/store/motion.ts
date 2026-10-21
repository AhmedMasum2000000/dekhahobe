import { create } from 'zustand';

const KEY = 'dekha:motion';
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
function savedPause() {
  try { return localStorage.getItem(KEY) === 'paused'; } catch { return false; }
}
function apply() {
  const { paused, reduced } = useMotion.getState();
  document.documentElement.dataset.motion = paused || reduced ? 'paused' : 'full';
}

export const useMotion = create<{ paused: boolean; reduced: boolean; toggle: () => void }>((set, get) => ({
  paused: savedPause(),
  reduced: preference.matches,
  toggle: () => {
    const paused = !get().paused;
    try { localStorage.setItem(KEY, paused ? 'paused' : 'full'); } catch { /* Optional preference storage. */ }
    set({ paused });
    apply();
  },
}));

export function initializeMotion() {
  apply();
  preference.addEventListener('change', () => {
    useMotion.setState({ reduced: preference.matches });
    apply();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) {
      useMotion.setState({ paused: savedPause() });
      apply();
    }
  });
}
