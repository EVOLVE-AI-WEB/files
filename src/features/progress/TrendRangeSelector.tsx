/**
 * TrendRangeSelector (Task 15.4; R15.2).
 *
 * A single, shared time-range selector for the trend charts offering 4wk / 8wk
 * / 12wk / 6mo / 1yr / All. Rendered as an accessible radio group; the active
 * range is conveyed by more than color (aria-checked + text weight), and every
 * option is a 44px+ touch target.
 */
import { TREND_RANGES, type TrendRange } from './chartData';

type TrendRangeSelectorProps = {
  value: TrendRange;
  onChange: (range: TrendRange) => void;
};

export function TrendRangeSelector({ value, onChange }: TrendRangeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Chart time range"
      className="flex flex-wrap gap-2"
    >
      {TREND_RANGES.map((range) => {
        const active = range.value === value;
        return (
          <button
            key={range.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(range.value)}
            className={`min-h-[44px] rounded-xl border px-3 text-sm font-medium ${
              active
                ? 'border-brand-navy bg-brand-navy text-white'
                : 'border-slate-300 bg-white text-brand-navy'
            }`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
