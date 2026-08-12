/**
 * Macro distribution bars (shared by the Calculator's Macro Visualization and
 * the Dashboard's macro bars). Renders protein / fat / carbohydrate as
 * horizontal bars sized by each macro's share of total macro calories, with
 * animated width (Framer Motion). Grams are shown rounded to the nearest gram
 * (R19.3); the bar proportions use the unrounded calorie contributions.
 *
 * Status/label is conveyed with text (macro name, grams, % share) — never by
 * color alone (R20.6).
 */
import { motion } from 'framer-motion';
import type { MacroResult } from '../../types';
import { roundGrams } from './format';

type MacroBarsProps = {
  macros: MacroResult;
  /** Heading id for aria labelling when embedded in a titled section. */
  headingId?: string;
};

type Row = {
  key: string;
  label: string;
  grams: number;
  calories: number;
  colorClass: string;
};

export function MacroBars({ macros, headingId }: MacroBarsProps) {
  const carbCalories = macros.carbGrams * 4;
  const rows: Row[] = [
    {
      key: 'protein',
      label: 'Protein',
      grams: macros.proteinGrams,
      calories: macros.proteinCalories,
      colorClass: 'bg-sky-500',
    },
    {
      key: 'fat',
      label: 'Fat',
      grams: macros.fatGrams,
      calories: macros.fatCalories,
      colorClass: 'bg-amber-500',
    },
    {
      key: 'carbs',
      label: 'Carbs',
      grams: macros.carbGrams,
      calories: carbCalories,
      colorClass: 'bg-fuchsia-500',
    },
  ];

  const totalMacroCalories = rows.reduce((sum, r) => sum + r.calories, 0);

  return (
    <ul
      className="flex flex-col gap-3"
      aria-describedby={headingId}
    >
      {rows.map((row) => {
        const share =
          totalMacroCalories > 0 ? (row.calories / totalMacroCalories) * 100 : 0;
        const grams = roundGrams(row.grams);
        const pct = Math.round(share);
        return (
          <li key={row.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-sm font-medium text-brand-navy">
              <span>{row.label}</span>
              <span className="tabular-nums text-slate-600">
                {grams} g · {pct}%
              </span>
            </div>
            <div
              className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
              role="img"
              aria-label={`${row.label}: ${grams} grams, ${pct}% of macro calories`}
            >
              <motion.div
                className={`h-full rounded-full ${row.colorClass}`}
                initial={{ width: 0 }}
                animate={{ width: `${share}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
