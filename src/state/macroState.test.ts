import { describe, expect, it } from 'vitest';
import type { MacroSettings, ProgressEntry } from '../types';
import { calculateMacros } from '../calculations/macros';
import type { AutoUpdatePeriod } from '../calculations/autoUpdate';
import { deriveMacroState } from './macroState';

const settings: MacroSettings = {
  calorieMultiplier: 16.8,
  proteinMultiplier: 1,
  fatMultiplier: 0.4,
};

const END_DATE = '2024-06-30';
const END_DAY_MS = Date.UTC(2024, 5, 30);

function isoBeforeEnd(offset: number): string {
  return new Date(END_DAY_MS - offset * 86_400_000).toISOString().slice(0, 10);
}

const freshPeriod: AutoUpdatePeriod = {
  start: isoBeforeEnd(6),
  end: END_DATE,
  lastUpdatedAt: null,
};

/** Four in-window entries -> a qualifying rolling average. */
const qualifyingEntries: ProgressEntry[] = [
  { id: 'a', loggedDate: isoBeforeEnd(3), weightKg: 71 },
  { id: 'b', loggedDate: isoBeforeEnd(2), weightKg: 71.5 },
  { id: 'c', loggedDate: isoBeforeEnd(1), weightKg: 72 },
  { id: 'd', loggedDate: isoBeforeEnd(0), weightKg: 71.5 },
];

describe('deriveMacroState', () => {
  it('Auto OFF uses baseline and exposes the derived rolling average without using it', () => {
    const state = deriveMacroState({
      baselineWeightKg: 70,
      autoUpdateEnabled: false,
      macroSettings: settings,
      endDate: END_DATE,
      updatePeriod: freshPeriod,
      previousActiveWeightKg: 70,
      progressEntries: qualifyingEntries,
    });

    expect(state.activeSource).toBe('baseline');
    expect(state.activeWeightKg).toBe(70);
    // Rolling average is still derived + surfaced (for messaging/charts).
    expect(state.latestSevenDayAverageKg).toBeCloseTo((71 + 71.5 + 72 + 71.5) / 4, 10);
    expect(state.macros).toEqual(calculateMacros(70, settings));
    // Baseline never mutated by the presence of entries.
    expect(state.baselineWeightKg).toBe(70);
  });

  it('Auto ON with a qualifying 7-day average uses the average as the active weight', () => {
    const state = deriveMacroState({
      baselineWeightKg: 70,
      autoUpdateEnabled: true,
      macroSettings: settings,
      endDate: END_DATE,
      updatePeriod: freshPeriod,
      previousActiveWeightKg: 70,
      progressEntries: qualifyingEntries,
    });

    const expectedAvg = (71 + 71.5 + 72 + 71.5) / 4;
    expect(state.qualification.qualifies).toBe(true);
    expect(state.activeSource).toBe('rolling_average');
    expect(state.activeWeightKg).toBe(expectedAvg);
    expect(state.macros).toEqual(calculateMacros(expectedAvg, settings));
    // Baseline remains the persistent reference — never overwritten.
    expect(state.baselineWeightKg).toBe(70);
  });

  it('Auto ON but too few measurements retains the previous active weight', () => {
    const state = deriveMacroState({
      baselineWeightKg: 70,
      autoUpdateEnabled: true,
      macroSettings: settings,
      endDate: END_DATE,
      updatePeriod: freshPeriod,
      previousActiveWeightKg: 69,
      // Only two in-window measurements -> below the minimum of 4.
      progressEntries: [
        { id: 'a', loggedDate: isoBeforeEnd(1), weightKg: 72 },
        { id: 'b', loggedDate: isoBeforeEnd(0), weightKg: 72.5 },
      ],
    });

    expect(state.qualification.qualifies).toBe(false);
    expect(state.activeSource).toBe('retained_previous');
    expect(state.activeWeightKg).toBe(69);
  });

  it('recomputes the rolling average when entries change without mutating baseline', () => {
    const baseInput = {
      baselineWeightKg: 70,
      autoUpdateEnabled: true,
      macroSettings: settings,
      endDate: END_DATE,
      updatePeriod: freshPeriod,
      previousActiveWeightKg: 70,
    };

    const before = deriveMacroState({ ...baseInput, progressEntries: qualifyingEntries });
    const after = deriveMacroState({
      ...baseInput,
      progressEntries: [
        ...qualifyingEntries,
        { id: 'e', loggedDate: isoBeforeEnd(4), weightKg: 70 },
      ],
    });

    expect(after.latestSevenDayAverageKg).not.toBe(before.latestSevenDayAverageKg);
    expect(after.baselineWeightKg).toBe(70);
  });
});
