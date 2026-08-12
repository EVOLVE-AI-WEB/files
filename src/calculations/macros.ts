/**
 * Macro calculation layer (design.md, Part II — Macro Calculation).
 *
 * Pure, deterministic, side-effect-free functions. They have NO knowledge of
 * *where* the active weight came from (baseline, rolling average, etc.); the
 * active-weight selection happens in the state layer. No intermediate value is
 * ever rounded — rounding is applied only at display time.
 *
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 6.4_
 */
import type { MacroResult, MacroSettings } from '../types';
import { kgToLb } from './conversions';

/** totalCalories = weightLb * calorieMultiplier. */
export function calculateCalories(
  weightLb: number,
  calorieMultiplier: number,
): number {
  return weightLb * calorieMultiplier;
}

/** proteinGrams = weightLb * proteinMultiplier. */
export function calculateProtein(
  weightLb: number,
  proteinMultiplier: number,
): number {
  return weightLb * proteinMultiplier;
}

/** fatGrams = weightLb * fatMultiplier. */
export function calculateFat(weightLb: number, fatMultiplier: number): number {
  return weightLb * fatMultiplier;
}

/**
 * Carbohydrates are computed from the REMAINING calories only, never directly
 * from bodyweight: carbGrams = (totalCalories - proteinCalories - fatCalories) / 4.
 * When protein + fat calories exceed total calories, the remaining calories are
 * negative; the caller (calculateMacros) surfaces the shortfall and never emits
 * a negative carb value.
 */
export function calculateCarbs(
  totalCalories: number,
  proteinCalories: number,
  fatCalories: number,
): number {
  return (totalCalories - proteinCalories - fatCalories) / 4;
}

const CARB_SHORTFALL_GUIDANCE =
  'Protein and fat targets exceed total calories. ' +
  'Increase the calorie multiplier or reduce protein/fat multipliers.';

/**
 * Compute the full macro target from an explicitly-selected active weight (kg)
 * and validated macro settings.
 *
 * Preconditions: activeCalculationWeightKg > 0 and finite; settings validated
 * (all multipliers > 0, within bounds).
 *
 * Postconditions:
 *  - No intermediate value is rounded.
 *  - Carbs receive the remaining calories; when protein+fat calories exceed
 *    total, isCarbShortfall === true, carbGrams === 0 (never negative), and a
 *    guidanceMessage is set.
 *  - Deterministic w.r.t. (weight, settings) regardless of the weight source.
 */
export function calculateMacros(
  activeCalculationWeightKg: number,
  settings: MacroSettings,
): MacroResult {
  const weightLb = kgToLb(activeCalculationWeightKg); // never rounded

  const totalCalories = calculateCalories(weightLb, settings.calorieMultiplier);
  const proteinGrams = calculateProtein(weightLb, settings.proteinMultiplier);
  const fatGrams = calculateFat(weightLb, settings.fatMultiplier);

  const proteinCalories = proteinGrams * 4;
  const fatCalories = fatGrams * 9;
  const remainingCalories = totalCalories - proteinCalories - fatCalories;

  if (remainingCalories < 0) {
    return {
      totalCalories,
      proteinGrams,
      fatGrams,
      carbGrams: 0, // never negative
      proteinCalories,
      fatCalories,
      remainingCalories,
      isCarbShortfall: true,
      guidanceMessage: CARB_SHORTFALL_GUIDANCE,
    };
  }

  return {
    totalCalories,
    proteinGrams,
    fatGrams,
    carbGrams: remainingCalories / 4,
    proteinCalories,
    fatCalories,
    remainingCalories,
    isCarbShortfall: false,
  };
}
