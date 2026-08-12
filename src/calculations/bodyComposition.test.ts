import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  calculateFatMass,
  calculateLeanBodyMass,
  getBodyFatCategory,
} from './bodyComposition';

describe('body-composition derivations', () => {
  it('derives fat mass and lean body mass from a valid body fat %', () => {
    // 80 kg at 20% body fat -> 16 kg fat, 64 kg lean.
    expect(calculateFatMass(80, 20)).toBeCloseTo(16, 10);
    expect(calculateLeanBodyMass(80, 20)).toBeCloseTo(64, 10);
  });

  it('returns null (never fabricated) when body fat is missing/invalid', () => {
    expect(calculateFatMass(80, undefined)).toBeNull();
    expect(calculateFatMass(80, null)).toBeNull();
    expect(calculateFatMass(80, NaN)).toBeNull();
    expect(calculateLeanBodyMass(80, undefined)).toBeNull();
    expect(calculateLeanBodyMass(80, null)).toBeNull();
    expect(calculateLeanBodyMass(80, NaN)).toBeNull();
  });
});

describe('getBodyFatCategory (ACE-style, sex-dependent)', () => {
  it('classifies male bands', () => {
    expect(getBodyFatCategory('male', 4, 30).label).toBe('Essential');
    expect(getBodyFatCategory('male', 10, 30).label).toBe('Athletes');
    expect(getBodyFatCategory('male', 15, 30).label).toBe('Fitness');
    expect(getBodyFatCategory('male', 20, 30).label).toBe('Average');
    expect(getBodyFatCategory('male', 30, 30).label).toBe('Obese');
  });

  it('classifies female bands', () => {
    expect(getBodyFatCategory('female', 12, 30).label).toBe('Essential');
    expect(getBodyFatCategory('female', 17, 30).label).toBe('Athletes');
    expect(getBodyFatCategory('female', 23, 30).label).toBe('Fitness');
    expect(getBodyFatCategory('female', 28, 30).label).toBe('Average');
    expect(getBodyFatCategory('female', 35, 30).label).toBe('Obese');
  });

  it('identifies the ACE source and sex', () => {
    const cat = getBodyFatCategory('male', 20, 30);
    expect(cat.source).toBe('ACE');
    expect(cat.sex).toBe('male');
  });
});

/**
 * Task 3.6 — Property 13: Fat/lean mass derived correctly & not fabricated when
 * BF% missing.
 * Validates: Requirements 9.1, 9.2.
 */
describe('Property 13', () => {
  const weightArb = fc.double({ min: 30, max: 300, noNaN: true });
  const bfArb = fc.double({ min: 0, max: 75, noNaN: true });

  it('Feature: macro-body-composition-calculator, Property 13: Fat/lean mass derived correctly & not fabricated when BF% missing (present)', () => {
    fc.assert(
      fc.property(weightArb, bfArb, (weight, bf) => {
        const fatMass = calculateFatMass(weight, bf);
        const leanMass = calculateLeanBodyMass(weight, bf);
        expect(fatMass).not.toBeNull();
        expect(leanMass).not.toBeNull();
        expect(fatMass as number).toBeCloseTo(weight * (bf / 100), 9);
        expect(leanMass as number).toBeCloseTo(weight - (fatMass as number), 9);
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: macro-body-composition-calculator, Property 13: Fat/lean mass derived correctly & not fabricated when BF% missing (absent)', () => {
    const missingArb = fc.constantFrom<number | null | undefined>(
      null,
      undefined,
      NaN,
    );
    fc.assert(
      fc.property(weightArb, missingArb, (weight, missing) => {
        expect(calculateFatMass(weight, missing)).toBeNull();
        expect(calculateLeanBodyMass(weight, missing)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
