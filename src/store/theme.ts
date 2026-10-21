import { create } from 'zustand';

type Theme = 'light' | 'dark';
const KEY = 'bpop:theme';
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.backgroundColor = theme === 'dark' ? '#121216' : '#FAF8F5';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121216' : '#FAF8F5');
}

export const useTheme = create<{ theme: Theme; toggle: () => void }>((set, get) => ({
  theme: savedTheme() ?? (systemTheme.matches ? 'dark' : 'light'),
  toggle: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, theme); } catch { /* The toggle still works without storage. */ }
    applyTheme(theme);
    set({ theme });
  },
}));

export function initializeTheme() {
  applyTheme(useTheme.getState().theme);
  const sync = () => {
    const theme = savedTheme() ?? (systemTheme.matches ? 'dark' : 'light');
    applyTheme(theme);
    useTheme.setState({ theme });
  };
  systemTheme.addEventListener('change', sync);
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) sync();
  });
}
