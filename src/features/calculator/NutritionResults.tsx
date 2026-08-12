/**
 * Nutrition Results section of the Calculator (R6.4, R19.2, R19.3, R19.5).
 *
 * Renders the daily macro targets from a computed MacroResult, applying display
 * rounding ONLY (calories to the nearest kcal, grams to the nearest gram). The
 * underlying MacroResult is never mutated. When the settings produce a carb
 * shortfall (protein + fat calories exceed total calories), carbs are pinned to
 * 0 g by the calc layer and the guidance message is surfaced here instead of a
 * negative value (R6.4).
 */
import { AlertTriangle } from 'lucide-react';
import type { MacroResult } from '../../types';
import { formatCalories, roundGrams } from '../shared/format';

type NutritionResultsProps = {
  macros: MacroResult;
  /** Optional line describing which weight the macros are based on (R12.8). */
  sourceNote?: string;
};

export function NutritionResults({ macros, sourceNote }: NutritionResultsProps) {
  const stats = [
    { label: 'Calories', value: formatCalories(macros.totalCalories), unit: 'kcal' },
    { label: 'Protein', value: String(roundGrams(macros.proteinGrams)), unit: 'g' },
    { label: 'Fat', value: String(roundGrams(macros.fatGrams)), unit: 'g' },
    { label: 'Carbs', value: String(roundGrams(macros.carbGrams)), unit: 'g' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {sourceNote ? (
        <p className="text-sm text-slate-500">{sourceNote}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4"
          >
            <dt className="text-sm font-medium text-slate-500">{stat.label}</dt>
            <dd className="text-2xl font-bold tabular-nums text-brand-navy">
              {stat.value}
              <span className="ml-1 text-base font-medium text-slate-400">
                {stat.unit}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {macros.isCarbShortfall ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            aria-hidden="true"
          />
          <p>{macros.guidanceMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
