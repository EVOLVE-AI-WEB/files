/**
 * Disclaimer (Task 17.5; R24.1–24.3).
 *
 * Surfaces the estimates/limitations disclaimer and frames the 16.8 kcal/lb
 * calorie multiplier as a configurable default (never a medically exact
 * figure). Both strings are reused verbatim from src/features/shared/disclaimer.ts
 * so there is a single source of truth. Rendered in the AppShell footer so it
 * is visible across the whole app; a `compact` variant omits the multiplier
 * note for tighter contexts.
 */
import { DISCLAIMER_TEXT, CALORIE_MULTIPLIER_NOTE } from './disclaimer';

type DisclaimerProps = {
  /** When true, show only the primary disclaimer text (no multiplier note). */
  compact?: boolean;
  className?: string;
};

export function Disclaimer({ compact = false, className }: DisclaimerProps) {
  return (
    <section
      aria-label="Disclaimer"
      className={`flex flex-col gap-2 text-xs leading-relaxed text-slate-500 ${
        className ?? ''
      }`}
    >
      <p>{DISCLAIMER_TEXT}</p>
      {!compact ? <p>{CALORIE_MULTIPLIER_NOTE}</p> : null}
    </section>
  );
}
