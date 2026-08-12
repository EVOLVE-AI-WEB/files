import { describe, expect, it } from 'vitest';
import type { MacroResult, MacroSettings } from '../types';
import { calculateMacros } from '../calculations/macros';
import {
  buildMacroTargetHistoryInsert,
  isEffectiveTargetChange,
  resolveMacroTargetSource,
  sourceForTrigger,
  type EffectiveTargetSnapshot,
} from './macroTargetHistory';

const settings: MacroSettings = {
  calorieMultiplier: 16.8,
  proteinMultiplier: 1,
  fatMultiplier: 0.4,
};

describe('isEffectiveTargetChange', () => {
  it('treats a null previous target as a change (first target must be captured)', () => {
    const next: EffectiveTargetSnapshot = {
      calculationWeightKg: 70,
      macroSettings: settings,
    };
    expect(isEffectiveTargetChange(null, next)).toBe(true);
  });

  it('detects a calculation-weight change', () => {
    const prev: EffectiveTargetSnapshot = {
      calculationWeightKg: 70,
      macroSettings: settings,
    };
    const next: EffectiveTargetSnapshot = {
      calculationWeightKg: 71.2,
      macroSettings: settings,
    };
    expect(isEffectiveTargetChange(prev, next)).toBe(true);
  });

  it('detects a multiplier change', () => {
    const prev: EffectiveTargetSnapshot = {
      calculationWeightKg: 70,
      macroSettings: settings,
    };
    const next: EffectiveTargetSnapshot = {
      calculationWeightKg: 70,
      macroSettings: { ...settings, calorieMultiplier: 18 },
    };
    expect(isEffectiveTargetChange(prev, next)).toBe(true);
  });

  it('reports no change when weight and all multipliers are identical', () => {
    const prev: EffectiveTargetSnapshot = {
      calculationWeightKg: 70,
      macroSettings: { ...settings },
    };
    const next: EffectiveTargetSnapshot = {
      calculationWeightKg: 70,
      macroSettings: { ...settings },
    };
    expect(isEffectiveTargetChange(prev, next)).toBe(false);
  });
});

describe('sourceForTrigger', () => {
  it('maps triggers to the persisted source enum', () => {
    expect(sourceForTrigger('initial_baseline')).toBe('baseline');
    expect(sourceForTrigger('manual_baseline_change')).toBe('manual_baseline_change');
    expect(sourceForTrigger('automatic_weekly_average')).toBe('automatic_weekly_average');
    expect(sourceForTrigger('macro_settings_change')).toBe('macro_settings_change');
  });
});

describe('resolveMacroTargetSource', () => {
  it('prioritizes a macro-settings change', () => {
    expect(
      resolveMacroTargetSource({
        activeSource: 'rolling_average',
        isMacroSettingsChange: true,
        isInitial: false,
      }),
    ).toBe('macro_settings_change');
  });

  it('maps a rolling-average active source to automatic_weekly_average', () => {
    expect(
      resolveMacroTargetSource({
        activeSource: 'rolling_average',
        isMacroSettingsChange: false,
        isInitial: false,
      }),
    ).toBe('automatic_weekly_average');
  });

  it('maps the very first baseline-sourced target to baseline', () => {
    expect(
      resolveMacroTargetSource({
        activeSource: 'baseline',
        isMacroSettingsChange: false,
        isInitial: true,
      }),
    ).toBe('baseline');
  });

  it('maps a later baseline-sourced change to manual_baseline_change', () => {
    expect(
      resolveMacroTargetSource({
        activeSource: 'baseline',
        isMacroSettingsChange: false,
        isInitial: false,
      }),
    ).toBe('manual_baseline_change');
  });
});

describe('buildMacroTargetHistoryInsert', () => {
  it('captures the full unrounded target for the append-only row', () => {
    const macros: MacroResult = calculateMacros(70, settings);
    const insert = buildMacroTargetHistoryInsert({
      userId: 'u-1',
      effectiveDate: '2024-03-10',
      source: 'baseline',
      calculationWeightKg: 70,
      rollingAverageKg: null,
      macroSettings: settings,
      macros,
    });

    // Calculated targets are captured at FULL precision (no rounding) — assert
    // they equal the pure calculator's exact output rather than display values.
    expect(insert).toEqual({
      userId: 'u-1',
      effectiveDate: '2024-03-10',
      calculationWeightKg: 70,
      source: 'baseline',
      rollingAverageKg: null,
      calorieMultiplier: 16.8,
      proteinMultiplier: 1,
      fatMultiplier: 0.4,
      calculatedCalories: macros.totalCalories,
      calculatedProteinG: macros.proteinGrams,
      calculatedFatG: macros.fatGrams,
      calculatedCarbsG: macros.carbGrams,
    });
    // Sanity-check the reference vector at display precision.
    expect(insert.calculatedCalories).toBeCloseTo(2592.63312, 5);
    expect(insert.calculatedCarbsG).toBeCloseTo(354.94382, 5);
  });
});
