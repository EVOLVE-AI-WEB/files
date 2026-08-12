/**
 * Lightweight number count-up (R21.5 — "Number counters count-up 0 -> target").
 *
 * A simple requestAnimationFrame ramp from 0 to the target over `durationMs`.
 * Deeper animation polish (spring easing, shared timing) is Task 17; this is a
 * deliberately minimal, dependency-free implementation. It honors
 * prefers-reduced-motion by rendering the final value immediately, and always
 * settles exactly on the target so the displayed figure matches the underlying
 * (display-rounded) value.
 */
import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type CountUpProps = {
  /** The final numeric value to count up to (already display-rounded). */
  value: number;
  /** Duration of the ramp in milliseconds. */
  durationMs?: number;
  /** Format the interpolated value for display. Defaults to Math.round. */
  format?: (n: number) => string;
  className?: string;
};

export function CountUp({
  value,
  durationMs = 800,
  format = (n) => String(Math.round(n)),
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState<number>(() =>
    prefersReducedMotion() ? value : 0,
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    let start: number | null = null;
    const from = 0;

    const tick = (now: number) => {
      if (start === null) {
        start = now;
      }
      const progress = Math.min((now - start) / durationMs, 1);
      setDisplay(from + (value - from) * progress);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value); // settle exactly on target
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
