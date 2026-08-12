/**
 * RollingAverageCard (Task 15.1; R11.5, R11.7).
 *
 * Shows the 7-day rolling weight average together with the measurement count
 * that produced it, e.g. "7-day average: 72.4 kg · 6 measurements". The value
 * is display-rounded to one decimal (R11.7) while the underlying calculation is
 * untouched. When fewer than a full window of measurements exist, that is
 * communicated clearly (the average still reflects only the days actually
 * logged — missing days are never fabricated). An honest empty state is shown
 * when there are no measurements in the window.
 */
import type { RollingAverageResult } from '../../types';
import { formatOneDecimal } from '../shared/format';

type RollingAverageCardProps = {
  rollingAverage: RollingAverageResult;
};

export function RollingAverageCard({ rollingAverage }: RollingAverageCardProps) {
  const { averageKg, measurementCount, windowDays } = rollingAverage;

  return (
    <section
      aria-labelledby="rolling-average-heading"
      className="flex flex-col gap-2 rounded-card bg-white p-5 shadow-card"
    >
      <h2
        id="rolling-average-heading"
        className="text-lg font-semibold text-brand-navy"
      >
        {windowDays}-day average
      </h2>

      {averageKg === null ? (
        <p className="text-sm text-slate-500">
          Log a weight to see your {windowDays}-day rolling average.
        </p>
      ) : (
        <>
          <p className="text-2xl font-bold tabular-nums text-brand-navy">
            {formatOneDecimal(averageKg)} kg
          </p>
          <p className="text-sm text-slate-500">
            {windowDays}-day average: {formatOneDecimal(averageKg)} kg ·{' '}
            {measurementCount}{' '}
            {measurementCount === 1 ? 'measurement' : 'measurements'}
          </p>
          {measurementCount < windowDays ? (
            <p className="text-xs text-slate-400">
              Based on the {measurementCount} day
              {measurementCount === 1 ? '' : 's'} you logged in the last{' '}
              {windowDays} days. Missing days are ignored, never counted as zero.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
