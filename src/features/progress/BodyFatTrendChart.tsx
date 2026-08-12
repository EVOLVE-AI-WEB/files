/**
 * BodyFatTrendChart (Task 15.4; R15.1, R15.4, R15.5, R15.6).
 *
 * Plots body-fat % over time. Missing body-fat days are honest gaps —
 * `connectNulls={false}` ensures the line is never drawn across days without a
 * measurement, and no values are fabricated. When the range contains no
 * body-fat measurements at all, an empty state is shown. A summary appears only
 * where data exists (R15.6).
 */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BodyCompPoint } from './chartData';
import { hasBodyFatData } from './chartData';
import { formatOneDecimal } from '../shared/format';

type BodyFatTrendChartProps = {
  points: BodyCompPoint[];
};

export function BodyFatTrendChart({ points }: BodyFatTrendChartProps) {
  const withData = hasBodyFatData(points);
  const latest = [...points]
    .reverse()
    .find((p) => p.bodyFatPercentage !== null);

  return (
    <section
      aria-labelledby="bodyfat-trend-heading"
      className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
    >
      <h2
        id="bodyfat-trend-heading"
        className="text-lg font-semibold text-brand-navy"
      >
        Body fat %
      </h2>

      {!withData ? (
        <p className="text-sm text-slate-500">
          No body-fat measurements in this range yet. Add a body-fat % when you
          log your weight to see this trend.
        </p>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 8, right: 12, bottom: 4, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  domain={['auto', 'auto']}
                  width={40}
                  unit="%"
                />
                <Tooltip
                  formatter={(value: number | string) =>
                    typeof value === 'number'
                      ? `${formatOneDecimal(value)}%`
                      : value
                  }
                />
                <Line
                  type="monotone"
                  dataKey="bodyFatPercentage"
                  name="Body fat %"
                  stroke="#EC4899"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500">
            Latest body fat:{' '}
            {latest && latest.bodyFatPercentage !== null
              ? `${formatOneDecimal(latest.bodyFatPercentage)}%`
              : '—'}
            . Days without a measurement are left as gaps, never estimated.
          </p>
        </>
      )}
    </section>
  );
}
