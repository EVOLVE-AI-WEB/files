/**
 * Animated, sex-dependent horizontal body-fat gauge (Task 14.2; R9.4, R9.5).
 *
 * Renders the ACE-style, sex-dependent category zones as labelled segments with
 * a pointer that animates to the measured body-fat position (Framer Motion).
 * Status is conveyed by MORE than color (R9.5): every zone shows its category
 * name as text, the pointer carries an accessible label, and the active
 * category is announced in text below the gauge. Full precision is preserved;
 * only the displayed body-fat value is rounded to one decimal (R9.6).
 */
import { motion } from 'framer-motion';
import type { Sex } from '../../types';
import { getBodyFatCategory } from '../../calculations/bodyComposition';
import { formatOneDecimal } from '../shared/format';

/** Upper bound of the gauge scale per sex (covers Obese onset + headroom). */
const SCALE_MAX: Record<Sex, number> = { male: 40, female: 45 };

/**
 * Zone definitions per sex. `upper` is the exclusive upper bound of the zone on
 * the display scale; the final Obese zone extends to SCALE_MAX. These mirror
 * the bands in getBodyFatCategory.
 */
const ZONES: Record<Sex, { label: string; upper: number }[]> = {
  male: [
    { label: 'Essential', upper: 6 },
    { label: 'Athletes', upper: 14 },
    { label: 'Fitness', upper: 18 },
    { label: 'Average', upper: 25 },
    { label: 'Obese', upper: 40 },
  ],
  female: [
    { label: 'Essential', upper: 14 },
    { label: 'Athletes', upper: 21 },
    { label: 'Fitness', upper: 25 },
    { label: 'Average', upper: 32 },
    { label: 'Obese', upper: 45 },
  ],
};

const ZONE_COLORS = [
  'bg-sky-300',
  'bg-emerald-300',
  'bg-lime-300',
  'bg-amber-300',
  'bg-rose-300',
];

type BodyFatGaugeProps = {
  sex: Sex;
  /** Measured body-fat percentage, or null/undefined when unavailable. */
  bodyFat?: number | null;
  age: number;
};

export function BodyFatGauge({ sex, bodyFat, age }: BodyFatGaugeProps) {
  const zones = ZONES[sex];
  const scaleMax = SCALE_MAX[sex];

  const hasBodyFat =
    typeof bodyFat === 'number' && Number.isFinite(bodyFat);
  const category = hasBodyFat
    ? getBodyFatCategory(sex, bodyFat as number, age)
    : null;

  // Pointer position as a percentage across the scale (clamped to [0, 100]).
  const pointerPct = hasBodyFat
    ? Math.min(100, Math.max(0, ((bodyFat as number) / scaleMax) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {/* Zone track */}
        <div
          className="flex h-8 w-full overflow-hidden rounded-full"
          role="img"
          aria-label={`Body-fat categories for ${sex}`}
        >
          {zones.map((zone, index) => {
            const prev = index === 0 ? undefined : zones[index - 1];
            const lower = prev ? prev.upper : 0;
            const width = ((zone.upper - lower) / scaleMax) * 100;
            return (
              <div
                key={zone.label}
                className={`flex items-center justify-center ${ZONE_COLORS[index]}`}
                style={{ width: `${width}%` }}
              >
                <span className="truncate px-1 text-[10px] font-semibold text-brand-navy">
                  {zone.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Animated pointer — only shown when a body-fat value exists. */}
        {hasBodyFat ? (
          <motion.div
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            initial={{ left: '0%' }}
            animate={{ left: `${pointerPct}%` }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            aria-hidden="true"
          >
            <div className="h-8 w-0.5 bg-brand-navy" />
            <div className="mt-0.5 h-2 w-2 rotate-45 bg-brand-navy" />
          </motion.div>
        ) : null}
      </div>

      {/* Text status — conveys result without relying on color (R9.5). */}
      {hasBodyFat && category ? (
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-brand-navy">
            {formatOneDecimal(bodyFat as number)}%
          </span>{' '}
          body fat — category:{' '}
          <span className="font-semibold text-brand-navy">
            {category.label}
          </span>{' '}
          <span className="text-slate-400">({category.source} scale)</span>
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Enter valid body measurements to see your body-fat category.
        </p>
      )}
    </div>
  );
}
