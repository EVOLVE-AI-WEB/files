import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { MacroSettings, ProgressEntry } from '../types';
import { calculateMacros } from '../calculations/macros';
import type { AutoUpdatePeriod } from '../calculations/autoUpdate';
import { selectActiveWeight } from './activeWeightSelector';
import { deriveMacroState } from './macroState';

// --- Shared fixtures / arbitraries ------------------------------------------

const END_DATE = '2024-06-30';
const END_DAY_MS = Date.UTC(2024, 5, 30);

/** ISO date `offset` days before END_DATE (offset 0 == END_DATE). */
function isoBeforeEnd(offset: number): string {
  return new Date(END_DAY_MS - offset * 86_400_000).toISOString().slice(0, 10);
}

/** A weekly update period ending at END_DATE with no prior update this period. */
const freshPeriod: AutoUpdatePeriod = {
  start: isoBeforeEnd(6),
  end: END_DATE,
  lastUpdatedAt: null,
};

const weightArb = fc.double({ min: 30, max: 300, noNaN: true });

const settingsArb: fc.Arbitrary<MacroSettings> = fc.record({
  calorieMultiplier: fc.double({ min: 1, max: 40, noNaN: true }),
  proteinMultiplier: fc.double({ min: 0.1, max: 3, noNaN: true }),
  fatMultiplier: fc.double({ min: 0.1, max: 2, noNaN: true }),
});

/** Distinct in-window entries (one per calendar day), positive weights. */
const entriesArb: fc.Arbitrary<ProgressEntry[]> = fc
  .uniqueArray(
    fc.record({
      dayOffset: fc.integer({ min: 0, max: 6 }),
      weightKg: weightArb,
    }),
    { minLength: 0, maxLength: 7, selector: (m) => m.dayOffset },
  )
  .map((rows) =>
    rows.map((m, i) => ({
      id: `e${i}`,
      loggedDate: isoBeforeEnd(m.dayOffset),
      weightKg: m.weightKg,
    })),
  );

// --- Unit tests for the pure selector ---------------------------------------

describe('selectActiveWeight — unit', () => {
  it('Auto OFF selects the baseline weight', () => {
    const sel = selectActiveWeight({
      baselineWeightKg: 70,
      autoUpdateEnabled: false,
      qualifyingRollingAverageKg: 71.2,
      previousActiveWeightKg: 68,
    });
    expect(sel.activeWeightKg).toBe(70);
    expect(sel.source).toBe('baseline');
  });

  it('Auto ON with a qualifying average selects the average', () => {
    const sel = selectActiveWeight({
      baselineWeightKg: 70,
      autoUpdateEnabled: true,
      qualifyingRollingAverageKg: 71.2,
      previousActiveWeightKg: 70,
    });
    expect(sel.activeWeightKg).toBe(71.2);
    expect(sel.source).toBe('rolling_average');
  });

  it('Auto ON without a qualifying average retains the previous active weight', () => {
    const sel = selectActiveWeight({
      baselineWeightKg: 70,
      autoUpdateEnabled: true,
      qualifyingRollingAverageKg: null,
      previousActiveWeightKg: 69.5,
    });
    expect(sel.activeWeightKg).toBe(69.5);
    expect(sel.source).toBe('retained_previous');
  });

  it('Auto ON, no qualifying average and no previous falls back to baseline', () => {
    const sel = selectActiveWeight({
      baselineWeightKg: 70,
      autoUpdateEnabled: true,
      qualifyingRollingAverageKg: null,
      previousActiveWeightKg: null,
    });
    expect(sel.activeWeightKg).toBe(70);
    expect(sel.source).toBe('retained_previous');
  });
});

// --- Property tests: weight-source separation invariants --------------------

/**
 * Property 7: A single daily weigh-in never changes baseline or macros.
 * Validates: Requirements 4.3, 4.6, 4.7, 10.6, 14.6.
 */
describe('weight-source separation — Property 7', () => {
  it('Feature: macro-body-composition-calculator, Property 7: A single daily weigh-in never changes baseline or macros', () => {
    fc.assert(
      fc.property(
        weightArb,
        weightArb,
        settingsArb,
        fc.boolean(),
        fc.option(weightArb, { nil: null }),
        (baseline, entryWeight, settings, autoEnabled, previousActive) => {
          const base = {
            baselineWeightKg: baseline,
            autoUpdateEnabled: autoEnabled,
            macroSettings: settings,
            endDate: END_DATE,
            updatePeriod: freshPeriod,
            previousActiveWeightKg: previousActive,
          };

          const before = deriveMacroState({ ...base, progressEntries: [] });
          const after = deriveMacroState({
            ...base,
            progressEntries: [
              { id: 'single', loggedDate: END_DATE, weightKg: entryWeight },
            ],
          });

          // Baseline is invariant across logging a weigh-in.
          expect(after.baselineWeightKg).toBe(baseline);

          // A single entry can never qualify (needs >= AUTO_UPDATE_MIN_MEASUREMENTS).
          expect(after.activeSource).not.toBe('rolling_average');

          // Macros are unchanged: the pre-existing active weight is still used,
          // not the newly logged single entry.
          expect(after.activeWeightKg).toBe(before.activeWeightKg);
          expect(after.macros).toEqual(before.macros);
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 8: Progress insert/update/delete never modifies baseline.
 * Validates: Requirements 4.3, 4.6, 10.6.
 */
describe('weight-source separation — Property 8', () => {
  it('Feature: macro-body-composition-calculator, Property 8: Progress insert/update/delete never modifies baseline', () => {
    fc.assert(
      fc.property(
        weightArb,
        settingsArb,
        fc.boolean(),
        entriesArb,
        entriesArb,
        (baseline, settings, autoEnabled, entriesA, entriesB) => {
          const base = {
            baselineWeightKg: baseline,
            autoUpdateEnabled: autoEnabled,
            macroSettings: settings,
            endDate: END_DATE,
            updatePeriod: freshPeriod,
            previousActiveWeightKg: baseline,
          };

          // entriesA -> entriesB models an arbitrary insert/update/delete.
          const stateA = deriveMacroState({ ...base, progressEntries: entriesA });
          const stateB = deriveMacroState({ ...base, progressEntries: entriesB });

          expect(stateA.baselineWeightKg).toBe(baseline);
          expect(stateB.baselineWeightKg).toBe(baseline);
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 9: Auto Macro OFF preserves baseline macro behavior.
 * Validates: Requirements 4.3.
 */
describe('weight-source separation — Property 9', () => {
  it('Feature: macro-body-composition-calculator, Property 9: Auto Macro OFF preserves baseline macro behavior', () => {
    fc.assert(
      fc.property(
        weightArb,
        settingsArb,
        entriesArb,
        fc.option(weightArb, { nil: null }),
        (baseline, settings, entries, previousActive) => {
          const state = deriveMacroState({
            baselineWeightKg: baseline,
            autoUpdateEnabled: false, // Auto OFF
            macroSettings: settings,
            endDate: END_DATE,
            updatePeriod: freshPeriod,
            previousActiveWeightKg: previousActive,
            progressEntries: entries,
          });

          expect(state.activeSource).toBe('baseline');
          expect(state.activeWeightKg).toBe(baseline);
          expect(state.macros).toEqual(calculateMacros(baseline, settings));
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 11: Goal weight never becomes macro weight.
 * Validates: Requirements 4.7, 14.6.
 *
 * The goal weight is structurally absent from both the selector inputs and the
 * derived-state inputs. This property confirms the active weight is always
 * sourced from the baseline or a qualifying rolling average — never from a goal
 * value, even when a goal weight coincides in the surrounding state.
 */
describe('weight-source separation — Property 11', () => {
  it('Feature: macro-body-composition-calculator, Property 11: Goal weight never becomes macro weight', () => {
    fc.assert(
      fc.property(
        weightArb, // baseline
        weightArb, // goalWeightKg (never fed to macros)
        settingsArb,
        fc.boolean(),
        entriesArb,
        fc.option(weightArb, { nil: null }),
        (baseline, goalWeightKg, settings, autoEnabled, entries, previousActive) => {
          const state = deriveMacroState({
            baselineWeightKg: baseline,
            autoUpdateEnabled: autoEnabled,
            macroSettings: settings,
            endDate: END_DATE,
            updatePeriod: freshPeriod,
            previousActiveWeightKg: previousActive,
            progressEntries: entries,
          });

          // The active weight must match exactly one of the allowed sources —
          // baseline, a qualifying rolling average, or the retained previous
          // active weight (which itself falls back to baseline). The goal
          // weight is never among them.
          if (state.activeSource === 'baseline') {
            expect(state.activeWeightKg).toBe(baseline);
          } else if (state.activeSource === 'rolling_average') {
            expect(state.activeWeightKg).toBe(state.qualification.rollingAverageKg);
          } else {
            expect(state.activeWeightKg).toBe(previousActive ?? baseline);
          }

          // Independence from the goal: the goal weight is not an input to the
          // derivation, so it can never have supplied the active weight.
          void goalWeightKg;
        },
      ),
      { numRuns: 200 },
    );
  });
});
