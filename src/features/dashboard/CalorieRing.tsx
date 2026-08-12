/**
 * Animated calorie ring (Task 14.3 / upgraded in Task 17.1; R21.5).
 *
 * Built on the shared <CircularProgress> arc (clockwise SVG stroke fill, ~1.2s
 * easeOut) with the calorie target counting up in the center (CountUp, ~0.8s).
 * The ring is decorative — it represents the full daily calorie target as a
 * completed arc — so it is marked aria-hidden inside CircularProgress and the
 * accessible calorie value is provided in adjacent text. Calories are displayed
 * rounded to the nearest kcal (R19.2). Both animations respect
 * prefers-reduced-motion.
 */
import { CountUp } from '../shared/CountUp';
import { CircularProgress } from '../shared/CircularProgress';
import { formatCalories, roundCalories } from '../shared/format';

type CalorieRingProps = {
  calories: number;
};

export function CalorieRing({ calories }: CalorieRingProps) {
  return (
    <CircularProgress progress={1} size={176} stroke={14} color="#4F5BE0">
      <CountUp
        value={roundCalories(calories)}
        format={(n) => Math.round(n).toLocaleString('en-US')}
        className="text-3xl font-bold tabular-nums text-brand-navy"
      />
      <span className="text-sm font-medium text-slate-500">kcal / day</span>
      {/* Accessible, non-animated value for assistive tech. */}
      <span className="sr-only">{formatCalories(calories)} calories per day</span>
    </CircularProgress>
  );
}
