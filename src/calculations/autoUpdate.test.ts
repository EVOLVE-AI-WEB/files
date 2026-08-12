import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isAutoMacroUpdateQualified } from './autoUpdate';
import type { AutoUpdatePeriod } from './autoUpdate';
import { CONFIG } from '../config';
import type { ProgressEntry } from '../types';

const END_DATE = '2024-06-30';
const END_MS = Date.UTC(2024, 5, 30);

/** Build N distinct in-window daily entries ending at END_DATE. */
function windowEntries(count: number, weightKg = 70): ProgressEntry[] {
  const entries: ProgressEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const iso = new Date(END_MS - i * 86_400_000).toISOString().slice(0, 10);
    entries.push({ id: `e${i}`, loggedDate: iso, weightKg });
  }
  return entries;
}

const period = (lastUpdatedAt: string | null = null): AutoUpdatePeriod => ({
  start: '2024-06-24',
  end: END_DATE,
  lastUpdatedAt,
});

describe('isAutoMacroUpdateQualified — unit', () => {
  it('qualifies with >= minimum measurements and no prior update this period', () => {
    const entries = windowEntries(CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS, 71.2);
    const q = isAutoMacroUpdateQualified(entries, period(null));
    expect(q.qualifies).toBe(true);
    expect(q.measurementCount).toBe(CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS);
    expect(q.rollingAverageKg).toBeCloseTo(71.2, 10);
    expect(q.minimumRequired).toBe(CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS);
  });

  it('does not qualify with fewer than the minimum measurements', () => {
    const entries = windowEntries(CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS - 1);
    const q = isAutoMacroUpdateQualified(entries, period(null));
    expect(q.qualifies).toBe(false);
    expect(q.measurementCount).toBe(CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS - 1);
    expect(q.reason).toContain('at least');
  });

  it('never qualifies from a single outlier measurement', () => {
    const entries: ProgressEntry[] = [
      { id: 'x', loggedDate: END_DATE, weightKg: 200 },
    ];
    const q = isAutoMacroUpdateQualified(entries, period(null));
    expect(q.qualifies).toBe(false);
    expect(q.measurementCount).toBe(1);
  });

  it('does not qualify when no measurements exist in the window', () => {
    const q = isAutoMacroUpdateQualified([], period(null));
    expect(q.qualifies).toBe(false);
    expect(q.rollingAverageKg).toBeNull();
    expect(q.measurementCount).toBe(0);
  });

  it('does not qualify (at most once per period) when already updated this period', () => {
    const entries = windowEntries(CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS);
    // lastUpdatedAt within [start, end] blocks another update this period.
    const q = isAutoMacroUpdateQualified(
      entries,
      period('2024-06-26T09:00:00.000Z'),
    );
    expect(q.qualifies).toBe(false);
    expect(q.reason).toBe('Already updated this period');
  });

  it('qualifies again when the last update was in a prior period', () => {
    const entries = windowEntries(CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS);
    // lastUpdatedAt before the period start -> not blocked.
    const q = isAutoMacroUpdateQualified(
      entries,
      period('2024-06-17T09:00:00.000Z'),
    );
    expect(q.qualifies).toBe(true);
  });

  it('honors an explicit minimumMeasurements override', () => {
    const entries = windowEntries(3);
    expect(isAutoMacroUpdateQualified(entries, period(null), 3).qualifies).toBe(
      true,
    );
    expect(isAutoMacroUpdateQualified(entries, period(null), 5).qualifies).toBe(
      false,
    );
  });
});

/**
 * Task 4.4 — Property 10: Auto Macro ON only uses qualifying averages
 * (>= min, <= once/week).
 * Validates: Requirements 12.3, 12.4, 12.6.
 */
describe('isAutoMacroUpdateQualified — property', () => {
  const scenarioArb = fc.record({
    count: fc.integer({ min: 0, max: 7 }),
    weightKg: fc.double({ min: 40, max: 200, noNaN: true }),
    alreadyUpdated: fc.boolean(),
  });

  it('Feature: macro-body-composition-calculator, Property 10: Auto Macro ON only uses qualifying averages (>= min, <= once/week)', () => {
    fc.assert(
      fc.property(scenarioArb, ({ count, weightKg, alreadyUpdated }) => {
        const entries = windowEntries(count, weightKg);
        const lastUpdatedAt = alreadyUpdated ? '2024-06-26T00:00:00.000Z' : null;
        const q = isAutoMacroUpdateQualified(entries, period(lastUpdatedAt));

        const min = CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS;
        // An update qualifies ONLY when it has enough measurements AND no
        // update has already occurred within the current period.
        const shouldQualify = count >= min && !alreadyUpdated;
        expect(q.qualifies).toBe(shouldQualify);

        if (q.qualifies) {
          // Qualifying updates use the rolling average (>= min measurements).
          expect(q.measurementCount).toBeGreaterThanOrEqual(min);
          expect(q.rollingAverageKg).toBeCloseTo(weightKg, 8);
        }
        // The minimum required is always surfaced for status messaging.
        expect(q.minimumRequired).toBe(min);
      }),
      { numRuns: 100 },
    );
  });
});
