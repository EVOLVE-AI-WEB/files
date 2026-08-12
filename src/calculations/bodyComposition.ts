/**
 * Body-composition derivations and categories
 * (design.md, Part II — Body Composition).
 *
 * Fat mass and lean body mass are DERIVED from a valid body-fat percentage and
 * are never manually entered. When no valid body-fat percentage exists, these
 * functions return `null` so callers can omit the values entirely — values are
 * never fabricated. No rounding is applied here (rounding is display-only).
 *
 * Body-fat categories are ACE-style, source-identified, and sex-dependent.
 *
 * _Requirements: 9.1, 9.2, 9.3_
 */
import type { BodyFatCategory, Sex } from '../types';

/** True when a body-fat percentage is a usable, finite number. */
function hasValidBodyFat(
  bodyFatPercentage: number | null | undefined,
): bodyFatPercentage is number {
  return (
    typeof bodyFatPercentage === 'number' &&
    Number.isFinite(bodyFatPercentage)
  );
}

/**
 * fatMass = weightKg * (bodyFatPercentage / 100). Returns null when body fat is
 * missing/invalid — never fabricated.
 */
export function calculateFatMass(
  weightKg: number,
  bodyFatPercentage: number | null | undefined,
): number | null {
  if (!hasValidBodyFat(bodyFatPercentage)) {
    return null;
  }
  return weightKg * (bodyFatPercentage / 100);
}

/**
 * leanBodyMass = weightKg - fatMass. Returns null when body fat is
 * missing/invalid — never fabricated.
 */
export function calculateLeanBodyMass(
  weightKg: number,
  bodyFatPercentage: number | null | undefined,
): number | null {
  const fatMass = calculateFatMass(weightKg, bodyFatPercentage);
  if (fatMass === null) {
    return null;
  }
  return weightKg - fatMass;
}

/**
 * Classify body fat using ACE-style, sex-dependent bands:
 *   Men:   Essential 2–5, Athletes 6–13, Fitness 14–17, Average 18–24, Obese 25+
 *   Women: Essential 10–13, Athletes 14–20, Fitness 21–24, Average 25–31, Obese 32+
 *
 * The `age` argument is part of the interface for symmetry with the other
 * categorizers; the ACE bands themselves are sex-dependent, not age-dependent.
 */
export function getBodyFatCategory(
  sex: Sex,
  bodyFat: number,
  _age: number,
): BodyFatCategory {
  const source = 'ACE';
  let label: BodyFatCategory['label'];

  if (sex === 'male') {
    if (bodyFat < 6) {
      label = 'Essential';
    } else if (bodyFat < 14) {
      label = 'Athletes';
    } else if (bodyFat < 18) {
      label = 'Fitness';
    } else if (bodyFat < 25) {
      label = 'Average';
    } else {
      label = 'Obese';
    }
  } else {
    if (bodyFat < 14) {
      label = 'Essential';
    } else if (bodyFat < 21) {
      label = 'Athletes';
    } else if (bodyFat < 25) {
      label = 'Fitness';
    } else if (bodyFat < 32) {
      label = 'Average';
    } else {
      label = 'Obese';
    }
  }

  return { label, sex, source };
}
