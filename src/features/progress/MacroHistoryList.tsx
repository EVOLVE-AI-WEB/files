/**
 * MacroHistoryList (Task 15.3; R13.1, R13.2, R13.3).
 *
 * Renders the append-only macro-target history in reverse-chronological order
 * (most recent first). Each row shows its source, effective date, the
 * calculation weight, and the calculated targets (calories / protein / fat /
 * carbs). This is a read-only audit view: there is deliberately NO edit or
 * delete UI, mirroring the append-only store (R13.1, R13.5).
 *
 * Records arrive already sorted most-recent-first from `useMacroTargetHistory`.
 */
import type { MacroTargetHistoryRecord, MacroTargetSource } from '../../types';
import {
  formatCalories,
  formatOneDecimal,
  roundGrams,
} from '../shared/format';
import { formatShortDate } from './chartData';

type MacroHistoryListProps = {
  records: MacroTargetHistoryRecord[];
};

const SOURCE_LABEL: Record<MacroTargetSource, string> = {
  baseline: 'Baseline',
  manual_baseline_change: 'Manual baseline change',
  automatic_weekly_average: 'Automatic weekly average',
  macro_settings_change: 'Macro settings change',
};

export function MacroHistoryList({ records }: MacroHistoryListProps) {
  return (
    <section
      aria-labelledby="macro-history-heading"
      className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
    >
      <h2
        id="macro-history-heading"
        className="text-lg font-semibold text-brand-navy"
      >
        Macro history
      </h2>

      {records.length === 0 ? (
        <p className="text-sm text-slate-500">
          Your macro target history will appear here as your targets change.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {records.map((record) => (
            <li
              key={record.id}
              className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-brand-navy">
                  {SOURCE_LABEL[record.source]}
                </span>
                <span className="text-xs text-slate-500">
                  {formatShortDate(record.effectiveDate)}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Calculation weight:{' '}
                {formatOneDecimal(record.calculationWeightKg)} kg
                {record.rollingAverageKg !== null
                  ? ` · 7-day avg ${formatOneDecimal(record.rollingAverageKg)} kg`
                  : ''}
              </p>
              <p className="text-sm tabular-nums text-brand-navy">
                {formatCalories(record.calculatedCalories)} kcal ·{' '}
                {roundGrams(record.calculatedProteinG)}g P ·{' '}
                {roundGrams(record.calculatedFatG)}g F ·{' '}
                {roundGrams(record.calculatedCarbsG)}g C
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
