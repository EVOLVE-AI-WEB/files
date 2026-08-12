import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calculateRollingWeightAverage } from './rollingAverage';
import { CONFIG } from '../config';
import type { ProgressEntry } from '../types';

/** Build a ProgressEntry with a valid weight for a given date. */
function entry(
  loggedDate: string,
  weightKg: number,
  id = loggedDate,
): ProgressEntry {
  return { id, loggedDate, weightKg };
}

describe('calculateRollingWeightAverage — unit', () => {
  it('averages valid entries within the inclusive 7-day window', () => {
    // Window ending 2024-03-10 covers 2024-03-04 .. 2024-03-10 inclusive.
    const entries = [
      entry('2024-03-04', 70),
      entry('2024-03-07', 72),
      entry('2024-03-10', 74),
    ];
    const r = calculateRollingWeightAverage(entries, '2024-03-10', 7);
    expect(r.measurementCount).toBe(3);
    expect(r.averageKg).toBeCloseTo((70 + 72 + 74) / 3, 10);
    expect(r.windowDays).toBe(7);
    expect(r.endDate).toBe('2024-03-10');
  });

  it('includes both window boundaries (start and end day)', () => {
    const entries = [
      entry('2024-03-04', 68), // exactly windowStart
      entry('2024-03-10', 72), // exactly endDate
    ];
    const r = calculateRollingWeightAverage(entries, '2024-03-10', 7);
    expect(r.measurementCount).toBe(2);
    expect(r.averageKg).toBeCloseTo(70, 10);
  });

  it('excludes entries just outside the window', () => {
    const entries = [
      entry('2024-03-03', 60), // one day before windowStart -> excluded
      entry('2024-03-11', 80), // after endDate -> excluded
      entry('2024-03-05', 70), // inside
    ];
    const r = calculateRollingWeightAverage(entries, '2024-03-10', 7);
    expect(r.measurementCount).toBe(1);
    expect(r.averageKg).toBe(70);
  });

  it('ignores missing days without zero-filling', () => {
    // Only 2 logged days in the window; average is of the present days only.
    const entries = [entry('2024-03-05', 70), entry('2024-03-09', 74)];
    const r = calculateRollingWeightAverage(entries, '2024-03-10', 7);
    expect(r.measurementCount).toBe(2);
    expect(r.averageKg).toBeCloseTo(72, 10);
  });

  it('returns null average and zero count when the window is empty', () => {
    const entries = [entry('2024-01-01', 70)];
    const r = calculateRollingWeightAverage(entries, '2024-03-10', 7);
    expect(r.averageKg).toBeNull();
    expect(r.measurementCount).toBe(0);
  });

  it('ignores entries with invalid (non-positive / non-finite) weights', () => {
    const entries: ProgressEntry[] = [
      { id: 'a', loggedDate: '2024-03-08', weightKg: 0 },
      { id: 'b', loggedDate: '2024-03-08', weightKg: -5 },
      { id: 'c', loggedDate: '2024-03-09', weightKg: Number.NaN },
      entry('2024-03-10', 71),
    ];
    const r = calculateRollingWeightAverage(entries, '2024-03-10', 7);
    expect(r.measurementCount).toBe(1);
    expect(r.averageKg).toBe(71);
  });

  it('preserves full precision (no rounding of the average)', () => {
    const entries = [entry('2024-03-10', 70.1), entry('2024-03-09', 70.2)];
    const r = calculateRollingWeightAverage(entries, '2024-03-10', 7);
    expect(r.averageKg).toBe((70.1 + 70.2) / 2);
  });

  it('defaults the window to CONFIG.ROLLING_WINDOW_DAYS', () => {
    const entries = [entry('2024-03-10', 70)];
    const r = calculateRollingWeightAverage(entries, '2024-03-10');
    expect(r.windowDays).toBe(CONFIG.ROLLING_WINDOW_DAYS);
  });
});

/**
 * Task 4.2 — Property 6: 7-day average ignores missing days and reports
 * measurement count.
 * Validates: Requirements 11.2, 11.3, 11.5.
 */
describe('calculateRollingWeightAverage — property', () => {
  // Generate distinct in-window day offsets (0..6 before the fixed end date)
  // paired with positive weights, so at most one entry per day.
  const endDate = '2024-06-30';
  const endDay = Date.UTC(2024, 5, 30);

  const measurementArb = fc.record({
    dayOffset: fc.integer({ min: 0, max: 6 }), // within the 7-day window
    weightKg: fc.double({ min: 30, max: 300, noNaN: true }),
  });

  const measurementsArb = fc
    .uniqueArray(measurementArb, {
      minLength: 1,
      maxLength: 7,
      selector: (m) => m.dayOffset, // one entry per calendar day
    });

  it('Feature: macro-body-composition-calculator, Property 6: 7-day average ignores missing days and reports measurement count', () => {
    fc.assert(
      fc.property(measurementsArb, (measurements) => {
        const entries: ProgressEntry[] = measurements.map((m, i) => {
          const ms = endDay - m.dayOffset * 86_400_000;
          const iso = new Date(ms).toISOString().slice(0, 10);
          return { id: `e${i}`, loggedDate: iso, weightKg: m.weightKg };
        });

        const r = calculateRollingWeightAverage(entries, endDate, 7);

        // measurementCount equals the number of present valid days (never
        // fabricated; missing days contribute nothing).
        expect(r.measurementCount).toBe(measurements.length);

        // Average is of present days only — computed independently here.
        const sum = measurements.reduce((acc, m) => acc + m.weightKg, 0);
        const expected = sum / measurements.length;
        expect(r.averageKg).not.toBeNull();
        expect(r.averageKg as number).toBeCloseTo(expected, 9);
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: macro-body-composition-calculator, Property 6: 7-day average ignores missing days and reports measurement count (adding gaps does not change the present-day average)', () => {
    fc.assert(
      fc.property(measurementsArb, (measurements) => {
        const entries: ProgressEntry[] = measurements.map((m, i) => {
          const ms = endDay - m.dayOffset * 86_400_000;
          const iso = new Date(ms).toISOString().slice(0, 10);
          return { id: `e${i}`, loggedDate: iso, weightKg: m.weightKg };
        });

        // Adding far-outside-window entries (i.e. "gaps" of missing in-window
        // days) must not affect the in-window average.
        const withOutside: ProgressEntry[] = [
          ...entries,
          { id: 'old1', loggedDate: '2020-01-01', weightKg: 1000 },
          { id: 'old2', loggedDate: '2019-12-31', weightKg: 1 },
        ];

        const base = calculateRollingWeightAverage(entries, endDate, 7);
        const withGaps = calculateRollingWeightAverage(withOutside, endDate, 7);

        expect(withGaps.measurementCount).toBe(base.measurementCount);
        expect(withGaps.averageKg as number).toBeCloseTo(
          base.averageKg as number,
          9,
        );
      }),
      { numRuns: 100 },
    );
  });
});
