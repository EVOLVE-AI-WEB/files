import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  validateAllowedEmailDomain,
  validateGoalWeight,
  validateMacroSettings,
  validateNavyMeasurements,
  validateProgressEntry,
} from './validators';
import { CONFIG } from '../config';
import type { MacroSettings } from '../types';

describe('validateAllowedEmailDomain — unit', () => {
  it('accepts each allowed domain (case-insensitive)', () => {
    for (const domain of CONFIG.ALLOWED_EMAIL_DOMAINS) {
      expect(validateAllowedEmailDomain(`user@${domain}`).valid).toBe(true);
      expect(
        validateAllowedEmailDomain(`USER@${domain.toUpperCase()}`).valid,
      ).toBe(true);
    }
  });

  it('rejects look-alike and superset domains', () => {
    expect(validateAllowedEmailDomain('a@gmail.co').valid).toBe(false);
    expect(validateAllowedEmailDomain('a@fakegmail.com').valid).toBe(false);
    expect(validateAllowedEmailDomain('a@gmail.com.example.com').valid).toBe(
      false,
    );
    expect(validateAllowedEmailDomain('a@notgmail.com').valid).toBe(false);
  });

  it('rejects strings without exactly one "@"', () => {
    expect(validateAllowedEmailDomain('gmail.com').valid).toBe(false);
    expect(validateAllowedEmailDomain('a@@gmail.com').valid).toBe(false);
    expect(validateAllowedEmailDomain('a@b@gmail.com').valid).toBe(false);
    expect(validateAllowedEmailDomain('@gmail.com').valid).toBe(false);
    expect(validateAllowedEmailDomain('a@').valid).toBe(false);
  });

  it('parses the domain after the FINAL "@" and trims/normalizes case', () => {
    expect(validateAllowedEmailDomain('  User@Gmail.COM  ').valid).toBe(true);
  });
});

/**
 * Task 5.2 — Property 14: Email allowlist exact-match rejects look-alikes.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.6.
 */
describe('validateAllowedEmailDomain — property', () => {
  const localArb = fc
    .string({ minLength: 1, maxLength: 12 })
    .filter((s) => !s.includes('@') && s.trim().length > 0);

  it('Feature: macro-body-composition-calculator, Property 14: Email allowlist exact-match rejects look-alikes (allowed domains valid, case-insensitive)', () => {
    fc.assert(
      fc.property(
        localArb,
        fc.constantFrom(...CONFIG.ALLOWED_EMAIL_DOMAINS),
        fc.boolean(),
        (local, domain, upper) => {
          const casedDomain = upper ? domain.toUpperCase() : domain;
          const res = validateAllowedEmailDomain(`${local}@${casedDomain}`);
          expect(res.valid).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Feature: macro-body-composition-calculator, Property 14: Email allowlist exact-match rejects look-alikes (prefix/suffix variants rejected)', () => {
    const affixArb = fc
      .string({ minLength: 1, maxLength: 8 })
      .filter((s) => /^[a-z0-9.]+$/i.test(s));
    fc.assert(
      fc.property(
        localArb,
        fc.constantFrom(...CONFIG.ALLOWED_EMAIL_DOMAINS),
        affixArb,
        fc.boolean(),
        (local, domain, affix, prefix) => {
          // A non-empty affix makes the domain a look-alike/superset that must
          // NOT be accepted by exact matching.
          const lookAlike = prefix ? `${affix}${domain}` : `${domain}.${affix}`;
          const res = validateAllowedEmailDomain(`${local}@${lookAlike}`);
          expect(res.valid).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Task 5.3 — Unit tests for macro-settings validation (bounds rejection).
 * _Requirements: 6.3_
 */
describe('validateMacroSettings — unit', () => {
  const defaults: MacroSettings = {
    calorieMultiplier: CONFIG.DEFAULT_CALORIE_MULTIPLIER,
    proteinMultiplier: CONFIG.DEFAULT_PROTEIN_MULTIPLIER,
    fatMultiplier: CONFIG.DEFAULT_FAT_MULTIPLIER,
  };

  it('accepts valid in-bounds defaults', () => {
    const r = validateMacroSettings(defaults);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejects non-positive multipliers', () => {
    const r = validateMacroSettings({
      calorieMultiplier: 0,
      proteinMultiplier: -1,
      fatMultiplier: 0,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects multipliers above their bounds (calorie 40, protein 3, fat 2)', () => {
    const r = validateMacroSettings({
      calorieMultiplier: 41,
      proteinMultiplier: 3.1,
      fatMultiplier: 2.1,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBe(3);
  });

  it('accepts values exactly at the upper bound', () => {
    const r = validateMacroSettings({
      calorieMultiplier: 40,
      proteinMultiplier: 3,
      fatMultiplier: 2,
    });
    expect(r.valid).toBe(true);
  });

  it('rejects non-finite multipliers', () => {
    const r = validateMacroSettings({
      calorieMultiplier: Number.NaN,
      proteinMultiplier: Number.POSITIVE_INFINITY,
      fatMultiplier: 0.4,
    });
    expect(r.valid).toBe(false);
  });
});

/**
 * Task 5.3 — Unit tests for Navy validation (pre-log10 guards, warning-but-valid).
 * _Requirements: 8.4, 8.5_
 */
describe('validateNavyMeasurements — unit', () => {
  it('accepts valid male measurements with waist > neck', () => {
    const r = validateNavyMeasurements('male', {
      heightCm: 178,
      neckCm: 38,
      waistCm: 85,
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it('rejects male measurements where waist <= neck (pre-log10 guard)', () => {
    const r = validateNavyMeasurements('male', {
      heightCm: 178,
      neckCm: 40,
      waistCm: 40,
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Waist must be greater than neck');
  });

  it('rejects female measurements where waist + hip <= neck (pre-log10 guard)', () => {
    // Force waist + hip - neck <= 0 with a large neck.
    const r = validateNavyMeasurements('female', {
      heightCm: 165,
      neckCm: 100,
      waistCm: 40,
      hipCm: 50,
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Waist plus hip must be greater than neck');
  });

  it('requires hip for females', () => {
    const r = validateNavyMeasurements('female', {
      heightCm: 165,
      neckCm: 32,
      waistCm: 70,
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Hip measurement is required for females');
  });

  it('rejects non-positive and non-finite measurements', () => {
    const r = validateNavyMeasurements('male', {
      heightCm: 0,
      neckCm: Number.NaN,
      waistCm: -10,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('produces a non-blocking warning for unusual-but-valid values', () => {
    // Waist > neck (valid) but neck is unusually large -> warning, still valid.
    const r = validateNavyMeasurements('male', {
      heightCm: 178,
      neckCm: 70,
      waistCm: 90,
    });
    expect(r.valid).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

/**
 * Task 5.3 — Unit tests for progress-entry validation (body-fat range).
 * _Requirements: 10.7_
 */
describe('validateProgressEntry — unit', () => {
  it('accepts a positive weight with no body fat', () => {
    expect(validateProgressEntry({ weightKg: 72.5 }).valid).toBe(true);
  });

  it('accepts a positive weight with in-range body fat', () => {
    expect(
      validateProgressEntry({ weightKg: 72.5, bodyFatPercentage: 18 }).valid,
    ).toBe(true);
  });

  it('rejects a missing weight', () => {
    const r = validateProgressEntry({});
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Weight is required');
  });

  it('rejects a non-positive weight', () => {
    expect(validateProgressEntry({ weightKg: 0 }).valid).toBe(false);
    expect(validateProgressEntry({ weightKg: -5 }).valid).toBe(false);
  });

  it('rejects a body fat outside 0–75', () => {
    expect(
      validateProgressEntry({ weightKg: 70, bodyFatPercentage: -1 }).valid,
    ).toBe(false);
    expect(
      validateProgressEntry({ weightKg: 70, bodyFatPercentage: 76 }).valid,
    ).toBe(false);
  });

  it('accepts body fat at the boundaries 0 and 75', () => {
    expect(
      validateProgressEntry({ weightKg: 70, bodyFatPercentage: 0 }).valid,
    ).toBe(true);
    expect(
      validateProgressEntry({ weightKg: 70, bodyFatPercentage: 75 }).valid,
    ).toBe(true);
  });
});

/**
 * Task 5.3 — Unit tests for goal-weight validation.
 * _Requirements: 14.1_
 */
describe('validateGoalWeight — unit', () => {
  it('accepts positive goal and starting weights', () => {
    expect(validateGoalWeight(80, 70).valid).toBe(true);
  });

  it('rejects non-positive goal weight', () => {
    expect(validateGoalWeight(0, 70).valid).toBe(false);
    expect(validateGoalWeight(-1, 70).valid).toBe(false);
  });

  it('rejects non-positive starting weight', () => {
    expect(validateGoalWeight(80, 0).valid).toBe(false);
  });

  it('rejects non-finite inputs', () => {
    expect(validateGoalWeight(Number.NaN, 70).valid).toBe(false);
    expect(validateGoalWeight(80, Number.POSITIVE_INFINITY).valid).toBe(false);
  });
});
