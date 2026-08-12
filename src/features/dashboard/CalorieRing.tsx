/**
 * Animated calorie ring (Task 14.3; R21.5).
 *
 * A circular SVG progress arc whose stroke fills clockwise on mount (Framer
 * Motion, ~1.2s easeOut), with the calorie target counting up in the center
 * (CountUp, ~0.8s). The ring is decorative — it represents the full daily
 * calorie target as a completed arc — so it is marked aria-hidden and the
 * accessible calorie value is provided in adjacent text. Calories are displayed
 * rounded to the nearest kcal (R19.2).
 */
import { motion } from 'framer-motion';
import { CountUp } from '../shared/CountUp';
import { formatCalories, roundCalories } from '../shared/format';

type CalorieRingProps = {
  calories: number;
};

const SIZE = 176;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ calories }: CalorieRingProps) {
  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>

      <div className="absolute flex flex-col items-center">
        <CountUp
          value={roundCalories(calories)}
          format={(n) => Math.round(n).toLocaleString('en-US')}
          className="text-3xl font-bold tabular-nums text-brand-navy"
        />
        <span className="text-sm font-medium text-slate-500">kcal / day</span>
        {/* Accessible, non-animated value for assistive tech. */}
        <span className="sr-only">
          {formatCalories(calories)} calories per day
        </span>
      </div>
    </div>
  );
}
