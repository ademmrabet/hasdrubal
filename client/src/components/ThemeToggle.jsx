import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cx } from '@/components/ui';

/** Bascule clair/sombre. Clair par defaut ; le choix est memorise par navigateur. */
export function ThemeToggle({ className }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={isDark ? 'Thème clair' : 'Thème sombre'}
      className={cx(
        'inline-flex items-center justify-center rounded-[var(--radius-control)] p-2',
        'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] transition-colors',
        className,
      )}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
