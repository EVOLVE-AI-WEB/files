/**
 * Unit-conversion helpers (design.md, Part II — Unit Conversion).
 *
 * All functions are pure and side-effect-free. They apply NO rounding: the
 * canonical value is preserved at full floating-point precision so that
 * round-trips (e.g. lbToKg(kgToLb(x))) return the original value within
 * floating-point tolerance. Rounding is applied only at display time.
 *
 * Canonical units are kg (weight) and cm (height / circumference); imperial
 * conversions exist only for input/display.
 *
 * _Requirements: 5.1, 8.1_
 */
import { CONFIG } from '../config';

/** Convert kilograms to pounds: kg * 2.20462. No rounding. */
export function kgToLb(kg: number): number {
  return kg * CONFIG.LB_PER_KG;
}

/** Convert pounds to kilograms: lb / 2.20462. No rounding. */
export function lbToKg(lb: number): number {
  return lb / CONFIG.LB_PER_KG;
}

/** Convert centimeters to inches: cm / 2.54. No rounding. */
export function cmToInches(cm: number): number {
  return cm / CONFIG.CM_PER_INCH;
}

/** Convert inches to centimeters: inches * 2.54. No rounding. */
export function inchesToCm(inches: number): number {
  return inches * CONFIG.CM_PER_INCH;
}
