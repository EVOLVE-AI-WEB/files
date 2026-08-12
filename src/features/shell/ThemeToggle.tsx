/**
 * ThemeToggle (Task 17.2; R21.4, R20.2, R20.5, R20.6).
 *
 * A single accessible control that switches between light and dark mode. It is
 * a real <button> (keyboard-operable, focus-visible), carries an explicit
 * aria-label plus aria-pressed to convey state to assistive tech, meets the
 * 44px minimum touch target, and shows BOTH an icon and text so state is never
 * conveyed by color alone (R20.6). The `whileTap` scale comes from <TapScale>.
 */
import { Moon, Sun } from 'lucide-react';
import { TapScale } from '../shared/motion';
import { useTheme } from './ThemeProvider';

type ThemeToggleProps = {
  /** Show a text label next to the icon (used in the sidebar / profile). */
  withLabel?: boolean;
  className?: string;
};

export function ThemeToggle({ withLabel = false, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const nextLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <TapScale
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      aria-pressed={isDark}
      title={nextLabel}
      className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-brand-navy ${
        className ?? ''
      }`}
    >
      {isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
      {withLabel ? <span>{isDark ? 'Light mode' : 'Dark mode'}</span> : null}
    </TapScale>
  );
}
