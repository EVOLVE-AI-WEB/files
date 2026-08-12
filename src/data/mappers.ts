/**
 * Row <-> domain mappers for the data-access layer (Task 9).
 *
 * The single translation boundary between the snake_case Supabase rows
 * (`dbTypes.ts`) and the camelCase domain types (`src/types`). Keeping this
 * mapping in one place means the rest of the app never touches snake_case and
 * canonical units (kg / cm / %) are preserved verbatim — no rounding, no unit
 * conversion happens here.
 */
import type {
  MacroSettingsRecord,
  MacroSettingsWrite,
  MacroTargetHistoryInsert,
  MacroTargetHistoryRecord,
  Profile,
  ProfileWrite,
  ProgressEntry,
  ProgressEntryWrite,
} from '../types';
import type {
  MacroSettingsRow,
  MacroSettingsRowWrite,
  MacroTargetHistoryRow,
  MacroTargetHistoryRowWrite,
  ProfileRow,
  ProfileRowWrite,
  ProgressEntryRow,
  ProgressEntryRowWrite,
} from './dbTypes';

/**
 * Assign a value onto a target key only when it is not `undefined`, so partial
 * write payloads never emit `undefined` columns (which would otherwise clobber
 * existing values). `null` is intentionally preserved — it explicitly clears a
 * nullable column.
 */
function assignDefined<T extends Record<string, unknown>, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------

export function mapProfileRow(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    name: row.name,
    age: row.age,
    biologicalSex: row.biological_sex,
    preferredUnit: row.preferred_unit,
    heightCm: row.height_cm,
    baselineWeightKg: row.baseline_weight_kg,
    neckCm: row.neck_cm,
    waistCm: row.waist_cm,
    hipCm: row.hip_cm,
    goalWeightKg: row.goal_weight_kg,
    goalStartWeightKg: row.goal_start_weight_kg,
    goalCreatedAt: row.goal_created_at,
    autoMacroUpdateEnabled: row.auto_macro_update_enabled,
    activeMacroWeightKg: row.active_macro_weight_kg,
    lastAutoMacroUpdateAt: row.last_auto_macro_update_at,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProfileRowWrite(write: ProfileWrite): ProfileRowWrite {
  const row: ProfileRowWrite = { user_id: write.userId };
  assignDefined(row, 'name', write.name);
  assignDefined(row, 'age', write.age);
  assignDefined(row, 'biological_sex', write.biologicalSex);
  assignDefined(row, 'preferred_unit', write.preferredUnit);
  assignDefined(row, 'height_cm', write.heightCm);
  assignDefined(row, 'baseline_weight_kg', write.baselineWeightKg);
  assignDefined(row, 'neck_cm', write.neckCm);
  assignDefined(row, 'waist_cm', write.waistCm);
  assignDefined(row, 'hip_cm', write.hipCm);
  assignDefined(row, 'goal_weight_kg', write.goalWeightKg);
  assignDefined(row, 'goal_start_weight_kg', write.goalStartWeightKg);
  assignDefined(row, 'goal_created_at', write.goalCreatedAt);
  assignDefined(row, 'auto_macro_update_enabled', write.autoMacroUpdateEnabled);
  assignDefined(row, 'active_macro_weight_kg', write.activeMacroWeightKg);
  assignDefined(row, 'last_auto_macro_update_at', write.lastAutoMacroUpdateAt);
  assignDefined(row, 'onboarding_completed', write.onboardingCompleted);
  return row;
}

// ---------------------------------------------------------------------------
// macro_settings
// ---------------------------------------------------------------------------

export function mapMacroSettingsRow(row: MacroSettingsRow): MacroSettingsRecord {
  return {
    userId: row.user_id,
    calorieMultiplier: row.calorie_multiplier,
    proteinMultiplier: row.protein_multiplier,
    fatMultiplier: row.fat_multiplier,
    updatedAt: row.updated_at,
  };
}

export function toMacroSettingsRowWrite(
  write: MacroSettingsWrite,
): MacroSettingsRowWrite {
  const row: MacroSettingsRowWrite = { user_id: write.userId };
  assignDefined(row, 'calorie_multiplier', write.calorieMultiplier);
  assignDefined(row, 'protein_multiplier', write.proteinMultiplier);
  assignDefined(row, 'fat_multiplier', write.fatMultiplier);
  return row;
}

// ---------------------------------------------------------------------------
// progress_entries
// ---------------------------------------------------------------------------

export function mapProgressEntryRow(row: ProgressEntryRow): ProgressEntry {
  const entry: ProgressEntry = {
    id: row.id,
    loggedDate: row.logged_date,
    weightKg: row.weight_kg,
  };
  if (row.body_fat_percentage !== null) {
    entry.bodyFatPercentage = row.body_fat_percentage;
  }
  if (row.body_fat_method !== null) {
    entry.bodyFatMethod = row.body_fat_method;
  }
  return entry;
}

export function toProgressEntryRowWrite(
  write: ProgressEntryWrite,
): ProgressEntryRowWrite {
  return {
    user_id: write.userId,
    logged_date: write.loggedDate,
    weight_kg: write.weightKg,
    body_fat_percentage: write.bodyFatPercentage ?? null,
    body_fat_method: write.bodyFatMethod ?? null,
  };
}

// ---------------------------------------------------------------------------
// macro_target_history
// ---------------------------------------------------------------------------

export function mapMacroTargetHistoryRow(
  row: MacroTargetHistoryRow,
): MacroTargetHistoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    effectiveDate: row.effective_date,
    calculationWeightKg: row.calculation_weight_kg,
    source: row.source,
    rollingAverageKg: row.rolling_average_kg,
    calorieMultiplier: row.calorie_multiplier,
    proteinMultiplier: row.protein_multiplier,
    fatMultiplier: row.fat_multiplier,
    calculatedCalories: row.calculated_calories,
    calculatedProteinG: row.calculated_protein_g,
    calculatedFatG: row.calculated_fat_g,
    calculatedCarbsG: row.calculated_carbs_g,
    createdAt: row.created_at,
  };
}

export function toMacroTargetHistoryRowWrite(
  insert: MacroTargetHistoryInsert,
): MacroTargetHistoryRowWrite {
  return {
    user_id: insert.userId,
    effective_date: insert.effectiveDate,
    calculation_weight_kg: insert.calculationWeightKg,
    source: insert.source,
    rolling_average_kg: insert.rollingAverageKg,
    calorie_multiplier: insert.calorieMultiplier,
    protein_multiplier: insert.proteinMultiplier,
    fat_multiplier: insert.fatMultiplier,
    calculated_calories: insert.calculatedCalories,
    calculated_protein_g: insert.calculatedProteinG,
    calculated_fat_g: insert.calculatedFatG,
    calculated_carbs_g: insert.calculatedCarbsG,
  };
}
