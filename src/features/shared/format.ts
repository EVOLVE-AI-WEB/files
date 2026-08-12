/**
 * Display-only rounding & formatting helpers (Task 14; R19.2–19.5).
 *
 * These NEVER mutate or feed back into the pure calculation layer — they are
 * applied strictly at render time. Per the rounding policy:
 *   - calories are rounded to the nearest kcal (R19.2),
 *   - protein / fat / carbohydrate grams to the nearest gram (R19.3),
 *   - BMI, body-fat %, fat mass, lean mass, and weight averages to 1 decimal
 *     place (R19.4).
 * Rounded macro calories may differ slightly from the sum of individually
 * rounded macros; we deliberately do NOT reconcile them (R19.5).
 */

/** Round calories to the nearest whole kcal. */
export function roundCalories(value: number): number {
  return Math.round(value);
}

/** Round macronutrient grams to the nearest whole gram. */
export function roundGrams(value: number): number {
  return Math.round(value);
}

/** Round to a single decimal place (BMI, body-fat %, mass, weight averages). */
export function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Format calories with a thousands separator, e.g. 2593 -> "2,593". */
export function formatCalories(value: number): string {
  return roundCalories(value).toLocaleString('en-US');
}

/** Format a weight/mass to one decimal place, e.g. 70 -> "70.0". */
export function formatOneDecimal(value: number): string {
  return roundOneDecimal(value).toFixed(1);
}

/** Format a weight in kilograms to one decimal place with a unit suffix. */
export function formatKg(value: number): string {
  return `${formatOneDecimal(value)} kg`;
}
