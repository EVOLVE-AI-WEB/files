/**
 * FatLeanTrendChart (Task 15.4; R15.1, R15.4, R15.5, R15.6).
 *
 * Plots derived fat mass and lean body mass over time. Both series are derived
 * only where a valid body-fat measurement exists; missing days are honest gaps
 * (`connectNulls={false}`) and are never fabricated. The two series are named
 * in the legend so they are distinguishable by more than color (R20.6). When
 * the range has no body-fat measurements, an empty state is shown; a summary is
 * shown only where data exists (R15.6).
 */
import {
  CartesianGrid,
  Legend,
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

type FatLeanTrendChartProps = {
  points: BodyCompPoint[];
};

export function FatLeanTrendChart({ points }: FatLeanTrendChartProps) {
  const withData = hasBodyFatData(points);
  const latest = [...points].reverse().find((p) => p.fatMassKg !== null);

  return (
    <section
      aria-labelledby="fatlean-trend-heading"
      className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
    >
      <h2
        id="fatlean-trend-heading"
        className="text-lg font-semibold text-brand-navy"
      >
        Fat mass & lean body mass
      </h2>

      {!withData ? (
        <p className="text-sm text-slate-500">
          No body-fat measurements in this range yet. Fat mass and lean body
          mass appear once you log a body-fat %.
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
                  width={44}
                  unit=" kg"
                />
                <Tooltip
                  formatter={(value: number | string) =>
                    typeof value === 'number'
                      ? `${formatOneDecimal(value)} kg`
                      : value
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="fatMassKg"
                  name="Fat mass"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="leanMassKg"
                  name="Lean body mass"
                  stroke="#0EA5E9"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500">
            Latest fat mass:{' '}
            {latest && latest.fatMassKg !== null
              ? `${formatOneDecimal(latest.fatMassKg)} kg`
              : '—'}
            {latest && latest.leanMassKg !== null
              ? ` · lean mass ${formatOneDecimal(latest.leanMassKg)} kg`
              : ''}
            . Derived only from days with a body-fat measurement.
          </p>
        </>
      )}
    </section>
  );
}
