import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  calculateFemaleNavyBodyFat,
  calculateMaleNavyBodyFat,
} from './navy';
import { cmToInches } from './conversions';

/**
 * Task 3.4 — Property 5: Navy formulas always receive inches and use log10.
 * Validates: Requirements 8.1, 8.2, 8.3, 26.1.
 */
describe('U.S. Navy body fat — fixtures', () => {
  it('matches a known male fixture (inches, log10)', () => {
    // heightIn 70, neckIn 15, waistIn 34 => ~17.51%
    const bf = calculateMaleNavyBodyFat(70, 15, 34);
    expect(bf).toBeCloseTo(17.51, 1);
  });

  it('matches a known female fixture (inches, log10)', () => {
    // heightIn 65, neckIn 13, waistIn 30, hipIn 40 => ~31.09%
    const bf = calculateFemaleNavyBodyFat(65, 13, 30, 40);
    expect(bf).toBeCloseTo(31.09, 1);
  });

  it('uses the exact male coefficients', () => {
    const heightIn = 70;
    const neckIn = 15;
    const waistIn = 34;
    const expected =
      86.010 * Math.log10(waistIn - neckIn) -
      70.041 * Math.log10(heightIn) +
      36.76;
    expect(calculateMaleNavyBodyFat(heightIn, neckIn, waistIn)).toBe(expected);
  });

  it('uses the exact female coefficients', () => {
    const heightIn = 65;
    const neckIn = 13;
    const waistIn = 30;
    const hipIn = 40;
    const expected =
      163.205 * Math.log10(waistIn + hipIn - neckIn) -
      97.684 * Math.log10(heightIn) -
      78.387;
    expect(calculateFemaleNavyBodyFat(heightIn, neckIn, waistIn, hipIn)).toBe(
      expected,
    );
  });
});

// Male generator in cm with waistCm > neckCm guaranteed (waist = neck + delta).
const maleCmArb = fc.record({
  heightCm: fc.double({ min: 140, max: 210, noNaN: true }),
  neckCm: fc.double({ min: 25, max: 45, noNaN: true }),
  waistDeltaCm: fc.double({ min: 5, max: 60, noNaN: true }),
});

// Female generator in cm; waist + hip - neck > 0 holds for these positive ranges.
const femaleCmArb = fc.record({
  heightCm: fc.double({ min: 140, max: 210, noNaN: true }),
  neckCm: fc.double({ min: 25, max: 45, noNaN: true }),
  waistCm: fc.double({ min: 55, max: 120, noNaN: true }),
  hipCm: fc.double({ min: 70, max: 130, noNaN: true }),
});

describe('U.S. Navy body fat — property', () => {
  it('Feature: macro-body-composition-calculator, Property 5: Navy formulas always receive inches and use log10 (male)', () => {
    fc.assert(
      fc.property(maleCmArb, ({ heightCm, neckCm, waistDeltaCm }) => {
        const waistCm = neckCm + waistDeltaCm;
        const heightIn = cmToInches(heightCm);
        const neckIn = cmToInches(neckCm);
        const waistIn = cmToInches(waistCm);

        // Independent log10-based reference over the SAME inch inputs.
        const reference =
          86.010 * Math.log10(waistIn - neckIn) -
          70.041 * Math.log10(heightIn) +
          36.76;

        const actual = calculateMaleNavyBodyFat(heightIn, neckIn, waistIn);
        expect(actual).toBeCloseTo(reference, 10);
        expect(Number.isFinite(actual)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: macro-body-composition-calculator, Property 5: Navy formulas always receive inches and use log10 (female)', () => {
    fc.assert(
      fc.property(femaleCmArb, ({ heightCm, neckCm, waistCm, hipCm }) => {
        const heightIn = cmToInches(heightCm);
        const neckIn = cmToInches(neckCm);
        const waistIn = cmToInches(waistCm);
        const hipIn = cmToInches(hipCm);

        const reference =
          163.205 * Math.log10(waistIn + hipIn - neckIn) -
          97.684 * Math.log10(heightIn) -
          78.387;

        const actual = calculateFemaleNavyBodyFat(
          heightIn,
          neckIn,
          waistIn,
          hipIn,
        );
        expect(actual).toBeCloseTo(reference, 10);
        expect(Number.isFinite(actual)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
