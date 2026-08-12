/**
 * Centralized validation layer (design.md, Part II — Validation Layer).
 *
 * Pure, reusable validators shared across the client (and, for the email
 * allowlist rule, mirrored authoritatively at the server boundary). Each
 * validator returns a structured result; none throw. Rounding is never applied.
 *
 * _Requirements: 2.1, 2.2, 2.5, 2.6, 6.3, 8.4, 8.6, 10.7, 14.1_
 */
import type {
  MacroSettings,
  NavyMeasurements,
  NavyValidationResult,
  ProgressEntry,
  Sex,
  ValidationResult,
} from '../types';
import { CONFIG } from '../config';

/** A finite number (rejects NaN and ±Infinity). */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Email-domain allowlist check (design pseudocode: validateAllowedEmailDomain).
 *
 * Exact, case-insensitive match on the domain parsed as the substring after
 * the FINAL `@`. No substring matching, so look-alikes/supersets such as
 * `gmail.co`, `fakegmail.com`, and `gmail.com.example.com` are all rejected.
 * Strings without exactly one parseable `@` structure are invalid.
 *
 * _Requirements: 2.1, 2.2, 2.5, 2.6_
 */
export function validateAllowedEmailDomain(
  email: string,
): { valid: boolean; reason?: string } {
  if (typeof email !== 'string') {
    return { valid: false, reason: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();

  // Require exactly one '@' with a non-empty local part and non-empty domain.
  const atCount = (trimmed.match(/@/g) ?? []).length;
  if (atCount !== 1) {
    return {
      valid: false,
      reason: 'Email must contain exactly one "@"',
    };
  }

  const atIndex = trimmed.lastIndexOf('@'); // final '@' (there is exactly one)
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (local.length === 0 || domain.length === 0) {
    return { valid: false, reason: 'Email is malformed' };
  }

  // Exact allowlist match — no substring/superset acceptance.
  const allowed = (CONFIG.ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(
    domain,
  );
  if (!allowed) {
    return {
      valid: false,
      reason: `Email domain "${domain}" is not permitted`,
    };
  }

  return { valid: true };
}

/**
 * Macro-settings bounds check. Rejects non-positive multipliers and any
 * multiplier outside its configured bounds (calorie ≤ 40, protein ≤ 3, fat ≤ 2).
 *
 * _Requirements: 6.3_
 */
export function validateMacroSettings(s: MacroSettings): ValidationResult {
  const errors: string[] = [];
  const bounds = CONFIG.MACRO_SETTINGS_BOUNDS;

  const check = (
    name: string,
    value: number,
    max: number,
  ): void => {
    if (!isFiniteNumber(value)) {
      errors.push(`${name} multiplier must be a finite number`);
      return;
    }
    if (value <= 0) {
      errors.push(`${name} multiplier must be greater than 0`);
      return;
    }
    if (value > max) {
      errors.push(`${name} multiplier must be at most ${max}`);
    }
  };

  check('Calorie', s.calorieMultiplier, bounds.calorie.max);
  check('Protein', s.proteinMultiplier, bounds.protein.max);
  check('Fat', s.fatMultiplier, bounds.fat.max);

  return { valid: errors.length === 0, errors };
}

// Non-blocking physiological warning ranges (canonical cm). Values outside
// these ranges are unusual but still produce a result.
const NAVY_WARN_RANGES = {
  heightCm: { min: 120, max: 230 },
  neckCm: { min: 20, max: 60 },
  waistCm: { min: 40, max: 200 },
  hipCm: { min: 50, max: 200 },
} as const;

/**
 * U.S. Navy measurement validation performed BEFORE invoking log10. Verifies
 * all measurements are positive and finite (no NaN/∞), that the required hip is
 * present for females, and that the pre-log10 arguments are positive:
 *   male:   waist − neck > 0
 *   female: waist + hip − neck > 0
 * Positivity is scale-invariant, so checks on canonical cm are equivalent to
 * the inch inputs the formula receives. Unusual-but-valid values yield
 * non-blocking warnings while the result still renders.
 *
 * _Requirements: 8.4, 8.6_
 */
export function validateNavyMeasurements(
  sex: Sex,
  m: NavyMeasurements,
): NavyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const positive = (name: string, value: unknown): value is number => {
    if (!isFiniteNumber(value)) {
      errors.push(`${name} must be a finite number`);
      return false;
    }
    if (value <= 0) {
      errors.push(`${name} must be greater than 0`);
      return false;
    }
    return true;
  };

  positive('Height', m.heightCm);
  const neckOk = positive('Neck', m.neckCm);
  const waistOk = positive('Waist', m.waistCm);

  let hipOk = true;
  if (sex === 'female') {
    if (m.hipCm === undefined || m.hipCm === null) {
      errors.push('Hip measurement is required for females');
      hipOk = false;
    } else {
      hipOk = positive('Hip', m.hipCm);
    }
  }

  // Pre-log10 argument positivity (only when the individual measurements are
  // themselves valid, to avoid noisy compounding errors).
  if (sex === 'male') {
    if (neckOk && waistOk && m.waistCm - m.neckCm <= 0) {
      errors.push('Waist must be greater than neck');
    }
  } else if (neckOk && waistOk && hipOk && m.hipCm !== undefined) {
    if (m.waistCm + m.hipCm - m.neckCm <= 0) {
      errors.push('Waist plus hip must be greater than neck');
    }
  }

  // Non-blocking warnings for unusual-but-valid measurements.
  const warnIfOutside = (
    name: string,
    value: number | undefined,
    range: { min: number; max: number },
  ): void => {
    if (isFiniteNumber(value) && (value < range.min || value > range.max)) {
      warnings.push(`${name} (${value} cm) is outside the typical range`);
    }
  };

  if (errors.length === 0) {
    warnIfOutside('Height', m.heightCm, NAVY_WARN_RANGES.heightCm);
    warnIfOutside('Neck', m.neckCm, NAVY_WARN_RANGES.neckCm);
    warnIfOutside('Waist', m.waistCm, NAVY_WARN_RANGES.waistCm);
    if (sex === 'female') {
      warnIfOutside('Hip', m.hipCm, NAVY_WARN_RANGES.hipCm);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Progress-entry validation. Requires a positive weight; body fat, when
 * present, must be within 0–75.
 *
 * _Requirements: 10.7_
 */
export function validateProgressEntry(
  e: Partial<ProgressEntry>,
): ValidationResult {
  const errors: string[] = [];

  if (e.weightKg === undefined || e.weightKg === null) {
    errors.push('Weight is required');
  } else if (!isFiniteNumber(e.weightKg)) {
    errors.push('Weight must be a finite number');
  } else if (e.weightKg <= 0) {
    errors.push('Weight must be greater than 0');
  }

  if (e.bodyFatPercentage !== undefined && e.bodyFatPercentage !== null) {
    if (!isFiniteNumber(e.bodyFatPercentage)) {
      errors.push('Body fat percentage must be a finite number');
    } else if (e.bodyFatPercentage < 0 || e.bodyFatPercentage > 75) {
      errors.push('Body fat percentage must be between 0 and 75');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Goal-weight validation. Requires a positive, finite goal weight and a
 * positive, finite starting weight.
 *
 * _Requirements: 14.1_
 */
export function validateGoalWeight(
  goalKg: number,
  startingKg: number,
): ValidationResult {
  const errors: string[] = [];

  if (!isFiniteNumber(goalKg)) {
    errors.push('Goal weight must be a finite number');
  } else if (goalKg <= 0) {
    errors.push('Goal weight must be greater than 0');
  }

  if (!isFiniteNumber(startingKg)) {
    errors.push('Starting weight must be a finite number');
  } else if (startingKg <= 0) {
    errors.push('Starting weight must be greater than 0');
  }

  return { valid: errors.length === 0, errors };
}
