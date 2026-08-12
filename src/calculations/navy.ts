/**
 * U.S. Navy body-fat calculations (design.md, Part II — U.S. Navy Body Fat).
 *
 * These pure functions operate on INCHES and use Math.log10 with the exact
 * Navy coefficients. Callers convert canonical cm measurements to inches with
 * `cmToInches` (cm / 2.54) before invoking them. Pre-log10 positivity guards
 * (waist - neck > 0 for males, waist + hip - neck > 0 for females, all
 * measurements > 0) live in the validation layer; these functions assume valid
 * input and apply no rounding.
 *
 * _Requirements: 8.1, 8.2, 8.3_
 */

/**
 * Male U.S. Navy body-fat percentage (inputs in inches):
 *   86.010 * log10(waistIn - neckIn) - 70.041 * log10(heightIn) + 36.76
 */
export function calculateMaleNavyBodyFat(
  heightIn: number,
  neckIn: number,
  waistIn: number,
): number {
  return (
    86.010 * Math.log10(waistIn - neckIn) -
    70.041 * Math.log10(heightIn) +
    36.76
  );
}

/**
 * Female U.S. Navy body-fat percentage (inputs in inches):
 *   163.205 * log10(waistIn + hipIn - neckIn) - 97.684 * log10(heightIn) - 78.387
 */
export function calculateFemaleNavyBodyFat(
  heightIn: number,
  neckIn: number,
  waistIn: number,
  hipIn: number,
): number {
  return (
    163.205 * Math.log10(waistIn + hipIn - neckIn) -
    97.684 * Math.log10(heightIn) -
    78.387
  );
}
