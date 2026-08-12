/**
 * Raw Supabase row shapes (snake_case) for the Macro & Body Composition
 * Calculator tables. These mirror the SQL migrations
 * (`supabase/migrations/*`) exactly and are the *only* place snake_case leaks
 * into the TypeScript codebase. The mappers in `mappers.ts` translate between
 * these rows and the camelCase domain types in `src/types`.
 *
 * Canonical stored units: weight kg, height/circumference cm, body fat %.
 */
import type { BodyFatMethod, MacroTargetSource, Sex, Unit } from '../types';

/** `public.profiles` — 1:1 with auth.users. */
export type ProfileRow = {
  user_id: string;
  name: string;
  age: number | null;
  biological_sex: Sex | null;
  preferred_unit: Unit;
  height_cm: number | null;
  baseline_weight_kg: number | null;
  neck_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  goal_weight_kg: number | null;
  goal_start_weight_kg: number | null;
  goal_created_at: string | null;
  auto_macro_update_enabled: boolean;
  active_macro_weight_kg: number | null;
  last_auto_macro_update_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

/** Insert/update payload for `public.profiles` (partial, user_id required). */
export type ProfileRowWrite = Partial<Omit<ProfileRow, 'user_id' | 'created_at' | 'updated_at'>> & {
  user_id: string;
};

/** `public.macro_settings` — 1:1 with auth.users. */
export type MacroSettingsRow = {
  user_id: string;
  calorie_multiplier: number;
  protein_multiplier: number;
  fat_multiplier: number;
  updated_at: string;
};

/** Insert/update payload for `public.macro_settings`. */
export type MacroSettingsRowWrite = Partial<
  Omit<MacroSettingsRow, 'user_id' | 'updated_at'>
> & {
  user_id: string;
};

/** `public.progress_entries` — 1:many with auth.users (Concept B). */
export type ProgressEntryRow = {
  id: string;
  user_id: string;
  logged_date: string;
  weight_kg: number;
  body_fat_percentage: number | null;
  body_fat_method: BodyFatMethod | null;
  created_at: string;
  updated_at: string;
};

/** Upsert payload for `public.progress_entries` (conflict on user_id,logged_date). */
export type ProgressEntryRowWrite = {
  user_id: string;
  logged_date: string;
  weight_kg: number;
  body_fat_percentage: number | null;
  body_fat_method: BodyFatMethod | null;
};

/** `public.macro_target_history` — append-only audit log. */
export type MacroTargetHistoryRow = {
  id: string;
  user_id: string;
  effective_date: string;
  calculation_weight_kg: number;
  source: MacroTargetSource;
  rolling_average_kg: number | null;
  calorie_multiplier: number;
  protein_multiplier: number;
  fat_multiplier: number;
  calculated_calories: number;
  calculated_protein_g: number;
  calculated_fat_g: number;
  calculated_carbs_g: number;
  created_at: string;
};

/** `public.reminder_preferences` — 0..1 with auth.users. */
export type ReminderPreferencesRow = {
  user_id: string;
  enabled: boolean;
  check_in_schedule: string | null;
  updated_at: string;
};

/** Upsert payload for `public.reminder_preferences` (conflict on user_id). */
export type ReminderPreferencesRowWrite = Partial<
  Omit<ReminderPreferencesRow, 'user_id' | 'updated_at'>
> & {
  user_id: string;
};

/** Insert payload for `public.macro_target_history` (no server-assigned cols). */
export type MacroTargetHistoryRowWrite = {
  user_id: string;
  effective_date: string;
  calculation_weight_kg: number;
  source: MacroTargetSource;
  rolling_average_kg: number | null;
  calorie_multiplier: number;
  protein_multiplier: number;
  fat_multiplier: number;
  calculated_calories: number;
  calculated_protein_g: number;
  calculated_fat_g: number;
  calculated_carbs_g: number;
};
