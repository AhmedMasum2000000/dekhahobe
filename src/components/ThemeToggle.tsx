import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/store/theme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      className="btn btn-outline h-10 w-10 shrink-0 p-0"
      onClick={toggle}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      data-testid="theme-toggle"
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
