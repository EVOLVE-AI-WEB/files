/**
 * 7-day rolling weight average (design.md, Part II — 7-Day Rolling Weight
 * Average).
 *
 * Pure and side-effect-free. Uses only valid weight entries whose `loggedDate`
 * falls within the most recent `windowDays` calendar days ending at (and
 * including) `endDate`. Missing days are IGNORED — never fabricated, never
 * treated as zero. Internal precision is preserved (rounding is display-only).
 * Reports the number of measurements actually used. Returns `averageKg = null`
 * with `measurementCount = 0` when the window contains no valid measurements.
 *
 * _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
 */
import type { ProgressEntry, RollingAverageResult } from '../types';
import { CONFIG } from '../config';

/**
 * Parse an ISO 'YYYY-MM-DD' date string into a UTC day-count (days since the
 * Unix epoch). Comparing day-counts avoids timezone/DST drift and gives a
 * clean inclusive calendar-day window. Returns null when the string is not a
 * well-formed calendar date.
 */
function toUtcDayNumber(isoDate: string): number | null {
  if (typeof isoDate !== 'string') {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Reject out-of-range month/day and non-round-tripping dates (e.g. 2024-02-31).
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(ms / 86_400_000);
}

/** A finite, strictly-positive weight is the only valid measurement. */
function hasValidWeight(entry: ProgressEntry): boolean {
  return (
    typeof entry.weightKg === 'number' &&
    Number.isFinite(entry.weightKg) &&
    entry.weightKg > 0
  );
}

/**
 * Compute the rolling weight average over the inclusive window
 * [endDate - (windowDays - 1), endDate].
 */
export function calculateRollingWeightAverage(
  progressEntries: ProgressEntry[],
  endDate: string,
  windowDays: number = CONFIG.ROLLING_WINDOW_DAYS,
): RollingAverageResult {
  const endDay = toUtcDayNumber(endDate);
  // Guard against an unparseable end date or non-positive window: no valid
  // window exists, so report an empty (honest) result rather than fabricating.
  if (endDay === null || !Number.isFinite(windowDays) || windowDays <= 0) {
    return { averageKg: null, measurementCount: 0, windowDays, endDate };
  }

  const windowStartDay = endDay - (windowDays - 1);

  let sum = 0;
  let count = 0;
  for (const entry of progressEntries) {
    if (!hasValidWeight(entry)) {
      continue;
    }
    const entryDay = toUtcDayNumber(entry.loggedDate);
    if (entryDay === null) {
      continue;
    }
    if (entryDay >= windowStartDay && entryDay <= endDay) {
      sum += entry.weightKg; // full precision — never rounded
      count += 1;
    }
  }

  if (count === 0) {
    return { averageKg: null, measurementCount: 0, windowDays, endDate };
  }

  return {
    averageKg: sum / count,
    measurementCount: count,
    windowDays,
    endDate,
  };
}
