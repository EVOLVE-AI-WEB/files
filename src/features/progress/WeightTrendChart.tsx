/**
 * WeightTrendChart (Task 15.4; R15.1, R15.3, R15.4, R15.5, R15.6).
 *
 * Overlays the raw daily weight and the 7-day rolling average, plus reference
 * lines for the baseline, active macro weight, and goal weight — each visually
 * distinguished (solid vs. dashed, distinct colors, labelled) and named in the
 * legend so meaning is not conveyed by color alone (R20.6). Data is ordered
 * chronologically upstream. When there are no points in the selected range an
 * honest empty state is shown instead of a fabricated chart (R15.4). A short
 * summary is shown only where data exists (R15.6).
 */
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeightPoint } from './chartData';
import { formatOneDecimal } from '../shared/format';

type WeightTrendChartProps = {
  points: WeightPoint[];
  baselineWeightKg: number;
  activeWeightKg: number;
  goalWeightKg: number | null;
};

export function WeightTrendChart({
  points,
  baselineWeightKg,
  activeWeightKg,
  goalWeightKg,
}: WeightTrendChartProps) {
  const hasData = points.length > 0;
  const first = hasData ? points[0] : null;
  const last = hasData ? points[points.length - 1] : null;
  const changeKg =
    first && last ? last.weightKg - first.weightKg : null;

  return (
    <section
      aria-labelledby="weight-trend-heading"
      className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
    >
      <h2
        id="weight-trend-heading"
        className="text-lg font-semibold text-brand-navy"
      >
        Weight & 7-day average
      </h2>

      {!hasData ? (
        <p className="text-sm text-slate-500">
          No weight entries in this range yet. Log your weight to see the trend.
        </p>
      ) : (
        <>
          <div className="h-64 w-full">
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
                  dataKey="weightKg"
                  name="Daily weight"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="averageKg"
                  name="7-day average"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <ReferenceLine
                  y={baselineWeightKg}
                  stroke="#94A3B8"
                  strokeDasharray="2 2"
                  label={{
                    value: 'Baseline',
                    position: 'insideTopLeft',
                    fontSize: 11,
                    fill: '#64748B',
                  }}
                />
                <ReferenceLine
                  y={activeWeightKg}
                  stroke="#0EA5E9"
                  strokeDasharray="4 2"
                  label={{
                    value: 'Active',
                    position: 'insideBottomLeft',
                    fontSize: 11,
                    fill: '#0EA5E9',
                  }}
                />
                {goalWeightKg !== null ? (
                  <ReferenceLine
                    y={goalWeightKg}
                    stroke="#10B981"
                    strokeDasharray="4 2"
                    label={{
                      value: 'Goal',
                      position: 'insideTopRight',
                      fontSize: 11,
                      fill: '#10B981',
                    }}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="text-xs text-slate-500">
            Latest: {last ? formatOneDecimal(last.weightKg) : '—'} kg
            {changeKg !== null
              ? ` · Change over range: ${changeKg >= 0 ? '+' : ''}${formatOneDecimal(changeKg)} kg`
              : ''}
            . Reference lines: baseline {formatOneDecimal(baselineWeightKg)} kg,
            active {formatOneDecimal(activeWeightKg)} kg
            {goalWeightKg !== null
              ? `, goal ${formatOneDecimal(goalWeightKg)} kg`
              : ''}
            .
          </p>
        </>
      )}
    </section>
  );
}
