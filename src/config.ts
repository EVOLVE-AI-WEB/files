/**
 * Centralized configuration thresholds for the Macro & Body Composition
 * Calculator. Mirrors design.md, Part II — Low-Level Design (Config).
 *
 * All calculation code reads its constants from here so defaults, unit
 * conversion factors, and bounds live in exactly one place.
 */
export const CONFIG = {
  DEFAULT_CALORIE_MULTIPLIER: 16.8,
  DEFAULT_PROTEIN_MULTIPLIER: 1.0,
  DEFAULT_FAT_MULTIPLIER: 0.4,
  LB_PER_KG: 2.20462,
  CM_PER_INCH: 2.54,
  ROLLING_WINDOW_DAYS: 7,
  AUTO_UPDATE_MIN_MEASUREMENTS: 4, // >= 4 valid measurements in the 7-day window
  ALLOWED_EMAIL_DOMAINS: [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
  ] as const,
  MACRO_SETTINGS_BOUNDS: {
    calorie: { min: 0.0001, max: 40 },
    protein: { min: 0.0001, max: 3 },
    fat: { min: 0.0001, max: 2 },
  },
} as const;
