/**
 * Auto macro-update qualification (design.md, Part II — Auto Macro Update
 * Qualification).
 *
 * Pure and side-effect-free. Auto Macro Update is OFF by default, explicit
 * opt-in, reversible, and fires AT MOST ONCE per weekly update period. It
 * qualifies only when a 7-day rolling average exists with at least
 * `minimumMeasurements` valid measurements in the window. When qualifying, the
 * caller sets activeCalculationWeightKg = rollingAverageKg; the baseline is
 * NEVER modified here. Insufficient data (or an already-applied update this
 * period) => no change, keep previous active weight, surface a status reason.
 *
 * This function NEVER estimates/fabricates data, never treats missing days as
 * zero (it delegates to calculateRollingWeightAverage), never uses a single
 * outlier by itself (the minimum-measurement guard prevents it), and never
 * overwrites the baseline.
 *
 * _Requirements: 12.3, 12.4, 12.5, 12.6, 12.7_
 */
import type { AutoUpdateQualification, ProgressEntry } from '../types';
import { CONFIG } from '../config';
import { calculateRollingWeightAverage } from './rollingAverage';

export type AutoUpdatePeriod = {
  start: string; // ISO 'YYYY-MM-DD' — inclusive period start
  end: string; // ISO 'YYYY-MM-DD' — inclusive period end (rolling-average end date)
  lastUpdatedAt: string | null; // ISO timestamp of the most recent auto update, or null
};

/** UTC day-number (days since epoch) for an ISO date/timestamp, or null. */
function toUtcDayNumber(iso: string): number | null {
  if (typeof iso !== 'string' || iso.trim() === '') {
    return null;
  }
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return null;
  }
  return Math.floor(ms / 86_400_000);
}

/**
 * True when `lastUpdatedAt` falls within the inclusive [start, end] calendar
 * period. Used to enforce the once-per-period guard.
 */
function isWithinPeriod(
  lastUpdatedAt: string,
  start: string,
  end: string,
): boolean {
  const last = toUtcDayNumber(lastUpdatedAt);
  const startDay = toUtcDayNumber(start);
  const endDay = toUtcDayNumber(end);
  if (last === null || startDay === null || endDay === null) {
    return false;
  }
  return last >= startDay && last <= endDay;
}

/**
 * Determine whether an automatic macro update qualifies for the given period.
 */
export function isAutoMacroUpdateQualified(
  progressEntries: ProgressEntry[],
  updatePeriod: AutoUpdatePeriod,
  minimumMeasurements: number = CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS,
): AutoUpdateQualification {
  // Once-per-period guard: an update already applied within this period blocks
  // another. Keeps previous active weight (caller retains it).
  if (
    updatePeriod.lastUpdatedAt !== null &&
    isWithinPeriod(updatePeriod.lastUpdatedAt, updatePeriod.start, updatePeriod.end)
  ) {
    return {
      qualifies: false,
      rollingAverageKg: null,
      measurementCount: 0,
      minimumRequired: minimumMeasurements,
      reason: 'Already updated this period',
    };
  }

  const avg = calculateRollingWeightAverage(
    progressEntries,
    updatePeriod.end,
    CONFIG.ROLLING_WINDOW_DAYS,
  );

  if (avg.averageKg === null || avg.measurementCount < minimumMeasurements) {
    return {
      qualifies: false,
      rollingAverageKg: avg.averageKg,
      measurementCount: avg.measurementCount,
      minimumRequired: minimumMeasurements,
      reason: `Need at least ${minimumMeasurements} measurements in the last ${CONFIG.ROLLING_WINDOW_DAYS} days`,
    };
  }

  return {
    qualifies: true,
    rollingAverageKg: avg.averageKg,
    measurementCount: avg.measurementCount,
    minimumRequired: minimumMeasurements,
    reason: 'Qualifying 7-day average available',
  };
}
