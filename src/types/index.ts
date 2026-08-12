/**
 * Core domain types for the Macro & Body Composition Calculator.
 *
 * These are the canonical in-memory shapes the calculation and state layers
 * operate on. Canonical persisted units are kg (weight), cm (height /
 * circumference), and % (body fat); conversions occur only for display/input.
 * Intermediate calculation values are never rounded (rounding is display-only).
 *
 * Definitions follow design.md, Part II — Low-Level Design (Core types).
 */

export type Unit = 'metric' | 'imperial';
export type Sex = 'male' | 'female';
export type BodyFatMethod = 'manual' | 'navy';

export type MacroSettings = {
  calorieMultiplier: number; // default 16.8 (kcal per lb)
  proteinMultiplier: number; // default 1.0  (g per lb)
  fatMultiplier: number; // default 0.4  (g per lb)
};

export type MacroResult = {
  totalCalories: number; // unrounded
  proteinGrams: number; // unrounded
  fatGrams: number; // unrounded
  carbGrams: number; // unrounded; = remaining calories / 4
  proteinCalories: number;
  fatCalories: number;
  remainingCalories: number;
  isCarbShortfall: boolean; // true when protein+fat calories > total
  guidanceMessage?: string; // set when isCarbShortfall
};

export type ProgressEntry = {
  id: string;
  loggedDate: string; // ISO 'YYYY-MM-DD'
  weightKg: number;
  bodyFatPercentage?: number;
  bodyFatMethod?: BodyFatMethod;
};

export type RollingAverageResult = {
  averageKg: number | null; // null when no valid measurements in window
  measurementCount: number; // number of valid days used (never fabricated)
  windowDays: number;
  endDate: string;
};

export type AutoUpdateQualification = {
  qualifies: boolean;
  rollingAverageKg: number | null;
  measurementCount: number;
  minimumRequired: number;
  reason: string; // human-readable status
};

export type GoalProgress = {
  startingWeightKg: number;
  currentWeightKg: number;
  goalWeightKg: number;
  changeKg: number; // current - starting (signed)
  remainingKg: number; // goal - current (signed)
  progressPercent: number | null; // null when starting == goal (divide-by-zero guarded)
  displayPercent: number; // capped 0..100 for the bar
  status: 'gaining' | 'losing' | 'reached' | 'exceeded' | 'undefined';
};

/**
 * U.S. Navy body-fat circumference measurements in canonical centimeters
 * (design.md — U.S. Navy Body Fat). `hipCm` is required for females and
 * ignored for males. The validation layer converts to inches (cm / 2.54) for
 * the calculation, but positivity/pre-log10 guards are scale-invariant.
 */
export type NavyMeasurements = {
  heightCm: number;
  neckCm: number;
  waistCm: number;
  hipCm?: number;
};

/** Result shape shared by the centralized validators. */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Navy validation additionally surfaces non-blocking warnings for
 * unusual-but-valid measurements.
 */
export type NavyValidationResult = ValidationResult & {
  warnings: string[];
};

/**
 * BMI category returned by getBMICategory. For users under age 20 the adult
 * screening bands do not apply and a BMI-for-age percentile note is returned
 * instead (appliesAdultCategories === false). BMI is always framed as a
 * screening measure, never a diagnosis (design.md — BMI Calculation).
 */
export type BMICategoryLabel =
  | 'Underweight'
  | 'Healthy'
  | 'Overweight'
  | 'Obesity Class I'
  | 'Obesity Class II'
  | 'Obesity Class III'
  | 'See BMI-for-age percentile';

export type BMICategory = {
  label: BMICategoryLabel;
  appliesAdultCategories: boolean;
  note?: string;
};

/**
 * ACE-style, source-identified body-fat categories (design.md — Body
 * Composition). Bands are sex-dependent:
 *   Men:   Essential 2–5, Athletes 6–13, Fitness 14–17, Average 18–24, Obese 25+
 *   Women: Essential 10–13, Athletes 14–20, Fitness 21–24, Average 25–31, Obese 32+
 */
export type BodyFatCategoryLabel =
  | 'Essential'
  | 'Athletes'
  | 'Fitness'
  | 'Average'
  | 'Obese';

export type BodyFatCategory = {
  label: BodyFatCategoryLabel;
  sex: Sex;
  source: string; // e.g. 'ACE'
};

/**
 * Source recorded on each append-only macro_target_history row
 * (design.md — Database Schema; Requirement 13.2).
 */
export type MacroTargetSource =
  | 'baseline'
  | 'manual_baseline_change'
  | 'automatic_weekly_average'
  | 'macro_settings_change';

/**
 * ---------------------------------------------------------------------------
 * Persistence-facing domain types (Task 9 — data-access layer)
 * ---------------------------------------------------------------------------
 * The camelCase in-memory shapes the state / data layers consume, mapped from
 * the snake_case Supabase rows by the mappers in `src/data/mappers.ts`. All
 * persisted values stay in canonical units: weight kg, height/circumference cm,
 * body fat %.
 */

/**
 * Concept A (baselineWeightKg), Concept D (persisted activeMacroWeightKg), and
 * Concept E (goalWeightKg / goalStartWeightKg) all live on the profile as
 * distinct fields — they are never conflated (five-concept invariant, R4.1).
 */
export type Profile = {
  userId: string;
  name: string;
  age: number | null;
  biologicalSex: Sex | null;
  preferredUnit: Unit;
  heightCm: number | null;
  baselineWeightKg: number | null;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  goalWeightKg: number | null;
  goalStartWeightKg: number | null;
  goalCreatedAt: string | null;
  autoMacroUpdateEnabled: boolean;
  activeMacroWeightKg: number | null;
  lastAutoMacroUpdateAt: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Fields the client may write when creating/updating a profile. `userId` is
 * required so writes are scoped to the authenticated caller (RLS also enforces
 * `auth.uid() = user_id`). All other fields are optional partial updates.
 */
export type ProfileWrite = {
  userId: string;
  name?: string;
  age?: number | null;
  biologicalSex?: Sex | null;
  preferredUnit?: Unit;
  heightCm?: number | null;
  baselineWeightKg?: number | null;
  neckCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  goalWeightKg?: number | null;
  goalStartWeightKg?: number | null;
  goalCreatedAt?: string | null;
  autoMacroUpdateEnabled?: boolean;
  activeMacroWeightKg?: number | null;
  lastAutoMacroUpdateAt?: string | null;
  onboardingCompleted?: boolean;
};

/** Full macro-settings row (domain shape) including ownership + audit stamp. */
export type MacroSettingsRecord = MacroSettings & {
  userId: string;
  updatedAt: string;
};

/** Writable macro-settings payload scoped to the authenticated caller. */
export type MacroSettingsWrite = {
  userId: string;
} & Partial<MacroSettings>;

/**
 * Payload for a progress-entry upsert. `loggedDate` + `userId` form the
 * conflict target for UNIQUE(user_id, logged_date); an existing date updates
 * in place (duplicate-date edit) rather than inserting a duplicate row.
 */
export type ProgressEntryWrite = {
  userId: string;
  loggedDate: string;
  weightKg: number;
  bodyFatPercentage?: number | null;
  bodyFatMethod?: BodyFatMethod | null;
};

/**
 * A single append-only macro_target_history record (domain shape). Written once
 * whenever an effective macro-target change occurs; never overwritten (R13.1).
 */
export type MacroTargetHistoryRecord = {
  id: string;
  userId: string;
  effectiveDate: string;
  calculationWeightKg: number;
  source: MacroTargetSource;
  rollingAverageKg: number | null;
  calorieMultiplier: number;
  proteinMultiplier: number;
  fatMultiplier: number;
  calculatedCalories: number;
  calculatedProteinG: number;
  calculatedFatG: number;
  calculatedCarbsG: number;
  createdAt: string;
};

/**
 * Optional "Body Composition Check-In" reminder preference (Concept: R16).
 * Mirrors the `reminder_preferences` table. Reminders are OFF by default and
 * require explicit opt-in plus notification permission before scheduling
 * (R16.1). `checkInSchedule` is a free-form, human-readable cadence string
 * (e.g. "Sat 10 PM, Sun 9 AM"); it is null when reminders are off / unset.
 */
export type ReminderPreferences = {
  userId: string;
  enabled: boolean;
  checkInSchedule: string | null;
  updatedAt: string;
};

/** Writable reminder-preferences payload scoped to the authenticated caller. */
export type ReminderPreferencesWrite = {
  userId: string;
  enabled?: boolean;
  checkInSchedule?: string | null;
};

/**
 * Content of a new append-only history row (no server-assigned id/createdAt).
 * Built by the state layer (`buildMacroTargetHistoryInsert`) and written by the
 * data layer's append hook.
 */
export type MacroTargetHistoryInsert = {
  userId: string;
  effectiveDate: string;
  calculationWeightKg: number;
  source: MacroTargetSource;
  rollingAverageKg: number | null;
  calorieMultiplier: number;
  proteinMultiplier: number;
  fatMultiplier: number;
  calculatedCalories: number;
  calculatedProteinG: number;
  calculatedFatG: number;
  calculatedCarbsG: number;
};
