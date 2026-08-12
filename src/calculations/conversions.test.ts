import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cmToInches, inchesToCm, kgToLb, lbToKg } from './conversions';
import { CONFIG } from '../config';

/**
 * Task 2.2 — Property 4: Unit conversion round-trips preserve canonical value.
 * Validates: Requirements 5.1, 8.1.
 *
 * Tag: Feature: macro-body-composition-calculator, Property 4: Unit conversion
 * round-trips preserve canonical value.
 */
describe('unit conversions', () => {
  it('produce exact known conversions (fixtures)', () => {
    // 70 kg -> 154.3234 lb (the verified reference vector weight).
    expect(kgToLb(70)).toBeCloseTo(154.3234, 10);
    expect(lbToKg(154.3234)).toBeCloseTo(70, 10);
    // 2.54 cm == 1 inch exactly.
    expect(cmToInches(2.54)).toBe(1);
    expect(inchesToCm(1)).toBe(2.54);
  });

  it('applies no rounding (retains full precision)', () => {
    // 1 kg -> 2.20462 lb, unrounded.
    expect(kgToLb(1)).toBe(CONFIG.LB_PER_KG);
    // 1 cm -> 1/2.54 inches, unrounded.
    expect(cmToInches(1)).toBe(1 / CONFIG.CM_PER_INCH);
  });

  it('Feature: macro-body-composition-calculator, Property 4: Unit conversion round-trips preserve canonical value (kg<->lb)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), (x) => {
        const roundTrip = lbToKg(kgToLb(x));
        // Relative tolerance for large magnitudes; absolute near zero.
        expect(Math.abs(roundTrip - x)).toBeLessThanOrEqual(
          1e-9 * Math.max(1, Math.abs(x)),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: macro-body-composition-calculator, Property 4: Unit conversion round-trips preserve canonical value (cm<->in)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), (x) => {
        const roundTrip = inchesToCm(cmToInches(x));
        expect(Math.abs(roundTrip - x)).toBeLessThanOrEqual(
          1e-9 * Math.max(1, Math.abs(x)),
        );
      }),
      { numRuns: 100 },
    );
  });
});
