/**
 * Pure helpers that turn persisted progress entries (Concept B) into the
 * chronologically-ordered series the Recharts trend charts render (Task 15.4;
 * R15.1, R15.5, R15.6).
 *
 * These are deliberately pure and side-effect-free so they are easy to test and
 * so the charts never fabricate data: the 7-day rolling average is derived on
 * read via `calculateRollingWeightAverage`, and body-composition points are
 * `null` on any day without a valid body-fat measurement (never invented, never
 * connected across gaps — the charts use `connectNulls={false}`). Display
 * rounding is applied only at the chart layer, never here.
 */
import type { ProgressEntry } from '../../types';
import { CONFIG } from '../../config';
import { calculateRollingWeightAverage } from '../../calculations/rollingAverage';
import {
  calculateFatMass,
  calculateLeanBodyMass,
} from '../../calculations/bodyComposition';
import { todayIso } from '../shared/macroDerivation';

/** Selectable trend-chart ranges (R15.2). */
export type TrendRange = '4wk' | '8wk' | '12wk' | '6mo' | '1yr' | 'all';

/** Ordered list of ranges with human labels for the range selector. */
export const TREND_RANGES: { value: TrendRange; label: string }[] = [
  { value: '4wk', label: '4wk' },
  { value: '8wk', label: '8wk' },
  { value: '12wk', label: '12wk' },
  { value: '6mo', label: '6mo' },
  { value: '1yr', label: '1yr' },
  { value: 'all', label: 'All' },
];

/** Number of calendar days each range spans (`Infinity` for "All"). */
const RANGE_DAYS: Record<TrendRange, number> = {
  '4wk': 28,
  '8wk': 56,
  '12wk': 84,
  '6mo': 182,
  '1yr': 365,
  all: Number.POSITIVE_INFINITY,
};

/** A daily-weight + 7-day-average point for the weight trend chart. */
export type WeightPoint = {
  date: string; // ISO 'YYYY-MM-DD'
  label: string; // short display label, e.g. "May 1"
  weightKg: number;
  averageKg: number | null;
};

/** A body-composition point; any field is null when body fat is missing. */
export type BodyCompPoint = {
  date: string;
  label: string;
  bodyFatPercentage: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
};

/** UTC day-number (days since epoch) for an ISO 'YYYY-MM-DD' string, or null. */
function toUtcDayNumber(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return null;
  }
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

/** A finite, strictly-positive weight is the only valid measurement. */
function hasValidWeight(entry: ProgressEntry): boolean {
  return (
    typeof entry.weightKg === 'number' &&
    Number.isFinite(entry.weightKg) &&
    entry.weightKg > 0
  );
}

/** Format an ISO date as a short, readable "MMM D" label. */
export function formatShortDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Valid weight entries, sorted chronologically (oldest first) (R15.5). */
function sortedValidEntries(entries: ProgressEntry[]): ProgressEntry[] {
  return entries
    .filter(hasValidWeight)
    .filter((e) => toUtcDayNumber(e.loggedDate) !== null)
    .slice()
    .sort((a, b) => a.loggedDate.localeCompare(b.loggedDate));
}

/**
 * Build the daily-weight + 7-day-average series. The rolling average for each
 * point is computed from the FULL entries list (so it reflects all logged days
 * in each window), then the whole series is returned in chronological order.
 */
export function buildWeightSeries(
  entries: ProgressEntry[],
  windowDays: number = CONFIG.ROLLING_WINDOW_DAYS,
): WeightPoint[] {
  return sortedValidEntries(entries).map((entry) => ({
    date: entry.loggedDate,
    label: formatShortDate(entry.loggedDate),
    weightKg: entry.weightKg,
    averageKg: calculateRollingWeightAverage(entries, entry.loggedDate, windowDays)
      .averageKg,
  }));
}

/**
 * Build the body-composition series (body fat %, fat mass, lean mass). Each
 * point corresponds to a logged day; fields are `null` when that day has no
 * valid body-fat measurement so the charts leave honest gaps (never fabricated,
 * never connected across missing points).
 */
export function buildBodyCompSeries(entries: ProgressEntry[]): BodyCompPoint[] {
  return sortedValidEntries(entries).map((entry) => {
    const bf =
      typeof entry.bodyFatPercentage === 'number' &&
      Number.isFinite(entry.bodyFatPercentage)
        ? entry.bodyFatPercentage
        : null;
    return {
      date: entry.loggedDate,
      label: formatShortDate(entry.loggedDate),
      bodyFatPercentage: bf,
      fatMassKg: calculateFatMass(entry.weightKg, bf),
      leanMassKg: calculateLeanBodyMass(entry.weightKg, bf),
    };
  });
}

/**
 * Filter a chronologically-ordered series of dated points to the given range,
 * relative to `endDate` (defaults to today). "All" returns every point.
 */
export function filterByRange<T extends { date: string }>(
  points: T[],
  range: TrendRange,
  endDate: string = todayIso(),
): T[] {
  const days = RANGE_DAYS[range];
  if (!Number.isFinite(days)) {
    return points;
  }
  const endDay = toUtcDayNumber(endDate);
  if (endDay === null) {
    return points;
  }
  const startDay = endDay - (days - 1);
  return points.filter((p) => {
    const day = toUtcDayNumber(p.date);
    return day !== null && day >= startDay && day <= endDay;
  });
}

/** True when a body-comp series has at least one non-null body-fat point. */
export function hasBodyFatData(points: BodyCompPoint[]): boolean {
  return points.some((p) => p.bodyFatPercentage !== null);
}
