/**
 * Tests for the pure chart-data helpers (Task 15.4; R15.1, R15.5).
 *
 * These verify chronological ordering, that the 7-day average is derived on
 * read, that body-composition points are null (never fabricated) on days
 * without a body-fat measurement, and that range filtering is inclusive.
 */
import { describe, expect, it } from 'vitest';
import type { ProgressEntry } from '../../types';
import {
  buildBodyCompSeries,
  buildWeightSeries,
  filterByRange,
  hasBodyFatData,
} from './chartData';

const ENTRIES: ProgressEntry[] = [
  { id: '3', loggedDate: '2024-05-03', weightKg: 71 },
  { id: '1', loggedDate: '2024-05-01', weightKg: 70, bodyFatPercentage: 20 },
  { id: '2', loggedDate: '2024-05-02', weightKg: 72 },
];

describe('buildWeightSeries', () => {
  it('orders points chronologically and derives the rolling average', () => {
    const series = buildWeightSeries(ENTRIES);
    expect(series.map((p) => p.date)).toEqual([
      '2024-05-01',
      '2024-05-02',
      '2024-05-03',
    ]);
    // Average on 2024-05-02 = (70 + 72) / 2 = 71.
    expect(series[1]?.averageKg).toBeCloseTo(71, 10);
    // Average on 2024-05-03 = (70 + 72 + 71) / 3 = 71.
    expect(series[2]?.averageKg).toBeCloseTo(71, 10);
  });
});

describe('buildBodyCompSeries', () => {
  it('derives fat/lean mass only where body fat exists, else null', () => {
    const series = buildBodyCompSeries(ENTRIES);
    // 2024-05-01 has body fat 20% -> fat mass 14, lean 56.
    expect(series[0]?.bodyFatPercentage).toBe(20);
    expect(series[0]?.fatMassKg).toBeCloseTo(14, 10);
    expect(series[0]?.leanMassKg).toBeCloseTo(56, 10);
    // 2024-05-02 has no body fat -> null (never fabricated).
    expect(series[1]?.bodyFatPercentage).toBeNull();
    expect(series[1]?.fatMassKg).toBeNull();
    expect(series[1]?.leanMassKg).toBeNull();
    expect(hasBodyFatData(series)).toBe(true);
  });
});

describe('filterByRange', () => {
  it('includes only points within the inclusive window ending at endDate', () => {
    const series = buildWeightSeries(ENTRIES);
    // A 2-day window ending 2024-05-03 keeps 05-02 and 05-03.
    const filtered = filterByRange(series, '4wk', '2024-05-03');
    expect(filtered.map((p) => p.date)).toEqual([
      '2024-05-01',
      '2024-05-02',
      '2024-05-03',
    ]);
    // "all" returns everything regardless of endDate.
    expect(filterByRange(series, 'all', '2024-05-03')).toHaveLength(3);
  });

  it('excludes points outside the range', () => {
    const series = buildWeightSeries(ENTRIES);
    // 4-week window ending far in the future excludes all May entries.
    const filtered = filterByRange(series, '4wk', '2024-09-01');
    expect(filtered).toHaveLength(0);
  });
});
