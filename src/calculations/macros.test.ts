import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calculateMacros } from './macros';
import { kgToLb } from './conversions';
import { CONFIG } from '../config';
import type { MacroSettings } from '../types';

const DEFAULT_SETTINGS: MacroSettings = {
  calorieMultiplier: CONFIG.DEFAULT_CALORIE_MULTIPLIER,
  proteinMultiplier: CONFIG.DEFAULT_PROTEIN_MULTIPLIER,
  fatMultiplier: CONFIG.DEFAULT_FAT_MULTIPLIER,
};

/** A fast-check generator for valid, in-bounds macro settings. */
const settingsArb = fc.record({
  calorieMultiplier: fc.double({
    min: CONFIG.MACRO_SETTINGS_BOUNDS.calorie.min,
    max: CONFIG.MACRO_SETTINGS_BOUNDS.calorie.max,
    noNaN: true,
  }),
  proteinMultiplier: fc.double({
    min: CONFIG.MACRO_SETTINGS_BOUNDS.protein.min,
    max: CONFIG.MACRO_SETTINGS_BOUNDS.protein.max,
    noNaN: true,
  }),
  fatMultiplier: fc.double({
    min: CONFIG.MACRO_SETTINGS_BOUNDS.fat.min,
    max: CONFIG.MACRO_SETTINGS_BOUNDS.fat.max,
    noNaN: true,
  }),
});

const weightArb = fc.double({ min: 20, max: 400, noNaN: true });

describe('calculateMacros', () => {
  /**
   * Task 2.4 — Verified 70 kg reference vector.
   * _Requirements: 5.7, 26.1_
   */
  it('matches the verified 70 kg reference vector with default multipliers', () => {
    const result = calculateMacros(70, DEFAULT_SETTINGS);

    // Exact unrounded intermediate/result values.
    expect(kgToLb(70)).toBeCloseTo(154.3234, 10);
    expect(result.totalCalories).toBeCloseTo(2592.63312, 10);
    expect(result.proteinGrams).toBeCloseTo(154.3234, 10);
    expect(result.fatGrams).toBeCloseTo(61.72936, 10);
    expect(result.carbGrams).toBeCloseTo(354.94382, 10);
    expect(result.isCarbShortfall).toBe(false);

    // Displayed (rounded) values: 2,593 / 154 / 62 / 355.
    expect(Math.round(result.totalCalories)).toBe(2593);
    expect(Math.round(result.proteinGrams)).toBe(154);
    expect(Math.round(result.fatGrams)).toBe(62);
    expect(Math.round(result.carbGrams)).toBe(355);
  });

  it('flags a carb shortfall (never negative) when protein+fat exceed total', () => {
    // High protein/fat multipliers with a low calorie multiplier force shortfall.
    const shortfallSettings: MacroSettings = {
      calorieMultiplier: 1,
      proteinMultiplier: 3,
      fatMultiplier: 2,
    };
    const result = calculateMacros(70, shortfallSettings);
    expect(result.isCarbShortfall).toBe(true);
    expect(result.carbGrams).toBe(0);
    expect(result.remainingCalories).toBeLessThan(0);
    expect(result.guidanceMessage).toBeDefined();
  });

  /**
   * Task 2.5 — Property 1: Macro formula determinism regardless of weight source.
   * Validates: Requirements 5.8, 4.2.
   */
  it('Feature: macro-body-composition-calculator, Property 1: Macro formula determinism regardless of weight source', () => {
    fc.assert(
      fc.property(weightArb, settingsArb, (w, s) => {
        expect(calculateMacros(w, s)).toEqual(calculateMacros(w, s));
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Task 2.6 — Property 2: Carbs equal remaining calories; never negative.
   * Validates: Requirements 5.5, 5.9, 6.4.
   */
  it('Feature: macro-body-composition-calculator, Property 2: Carbs equal remaining calories; never negative', () => {
    fc.assert(
      fc.property(weightArb, settingsArb, (w, s) => {
        const r = calculateMacros(w, s);
        // Carbs never negative.
        expect(r.carbGrams).toBeGreaterThanOrEqual(0);

        if (r.isCarbShortfall) {
          expect(r.carbGrams).toBe(0);
          expect(r.remainingCalories).toBeLessThan(0);
          expect(r.guidanceMessage).toBeDefined();
        } else {
          // Carbs are derived from remaining calories only.
          expect(r.carbGrams).toBeCloseTo(r.remainingCalories / 4, 9);
          // Energy-balance postcondition within FP tolerance.
          const recombined =
            r.proteinGrams * 4 + r.fatGrams * 9 + r.carbGrams * 4;
          expect(recombined).toBeCloseTo(r.totalCalories, 6);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Task 2.7 — Property 3: Intermediate values never rounded.
   * Validates: Requirements 5.6, 19.1.
   */
  it('Feature: macro-body-composition-calculator, Property 3: Intermediate values never rounded', () => {
    fc.assert(
      fc.property(weightArb, settingsArb, (w, s) => {
        const r = calculateMacros(w, s);
        const weightLb = w * CONFIG.LB_PER_KG;

        // Exact (unrounded) relationships hold.
        expect(r.totalCalories).toBe(weightLb * s.calorieMultiplier);
        expect(r.proteinGrams).toBe(weightLb * s.proteinMultiplier);
        expect(r.fatGrams).toBe(weightLb * s.fatMultiplier);

        // Values retain fractional precision (are not integer-rounded) in general.
        // At least one core value should carry a fractional part for arbitrary inputs;
        // assert the exact-equality relationships above rather than integrality.
        expect(Number.isFinite(r.totalCalories)).toBe(true);
        expect(Number.isFinite(r.carbGrams)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
