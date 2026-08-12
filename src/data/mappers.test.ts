import { describe, expect, it } from 'vitest';
import type {
  MacroSettingsRow,
  MacroTargetHistoryRow,
  ProfileRow,
  ProgressEntryRow,
} from './dbTypes';
import {
  mapMacroSettingsRow,
  mapMacroTargetHistoryRow,
  mapProfileRow,
  mapProgressEntryRow,
  toMacroSettingsRowWrite,
  toMacroTargetHistoryRowWrite,
  toProfileRowWrite,
  toProgressEntryRowWrite,
} from './mappers';

const profileRow: ProfileRow = {
  user_id: 'u-1',
  name: 'Alex',
  age: 30,
  biological_sex: 'male',
  preferred_unit: 'metric',
  height_cm: 180,
  baseline_weight_kg: 70,
  neck_cm: 38,
  waist_cm: 82,
  hip_cm: null,
  goal_weight_kg: 75,
  goal_start_weight_kg: 70,
  goal_created_at: '2024-01-01T00:00:00.000Z',
  auto_macro_update_enabled: false,
  active_macro_weight_kg: 70,
  last_auto_macro_update_at: null,
  onboarding_completed: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
};

describe('profile mappers', () => {
  it('maps a snake_case row to the camelCase domain shape (canonical units kept)', () => {
    const profile = mapProfileRow(profileRow);
    expect(profile).toEqual({
      userId: 'u-1',
      name: 'Alex',
      age: 30,
      biologicalSex: 'male',
      preferredUnit: 'metric',
      heightCm: 180,
      baselineWeightKg: 70,
      neckCm: 38,
      waistCm: 82,
      hipCm: null,
      goalWeightKg: 75,
      goalStartWeightKg: 70,
      goalCreatedAt: '2024-01-01T00:00:00.000Z',
      autoMacroUpdateEnabled: false,
      activeMacroWeightKg: 70,
      lastAutoMacroUpdateAt: null,
      onboardingCompleted: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });
  });

  it('omits undefined fields but preserves explicit null on write payloads', () => {
    const row = toProfileRowWrite({
      userId: 'u-1',
      baselineWeightKg: 72,
      goalWeightKg: null, // explicit clear
    });
    expect(row).toEqual({
      user_id: 'u-1',
      baseline_weight_kg: 72,
      goal_weight_kg: null,
    });
    // Fields not provided must not appear (so upsert never clobbers them).
    expect('name' in row).toBe(false);
    expect('age' in row).toBe(false);
  });
});

describe('macro settings mappers', () => {
  it('round-trips row -> domain', () => {
    const row: MacroSettingsRow = {
      user_id: 'u-1',
      calorie_multiplier: 16.8,
      protein_multiplier: 1,
      fat_multiplier: 0.4,
      updated_at: '2024-01-02T00:00:00.000Z',
    };
    expect(mapMacroSettingsRow(row)).toEqual({
      userId: 'u-1',
      calorieMultiplier: 16.8,
      proteinMultiplier: 1,
      fatMultiplier: 0.4,
      updatedAt: '2024-01-02T00:00:00.000Z',
    });
  });

  it('builds a partial write payload with only provided multipliers', () => {
    const row = toMacroSettingsRowWrite({ userId: 'u-1', calorieMultiplier: 18 });
    expect(row).toEqual({ user_id: 'u-1', calorie_multiplier: 18 });
  });
});

describe('progress entry mappers', () => {
  it('includes optional body-fat fields only when present', () => {
    const withBf: ProgressEntryRow = {
      id: 'p-1',
      user_id: 'u-1',
      logged_date: '2024-03-10',
      weight_kg: 70.5,
      body_fat_percentage: 15,
      body_fat_method: 'navy',
      created_at: '2024-03-10T00:00:00.000Z',
      updated_at: '2024-03-10T00:00:00.000Z',
    };
    expect(mapProgressEntryRow(withBf)).toEqual({
      id: 'p-1',
      loggedDate: '2024-03-10',
      weightKg: 70.5,
      bodyFatPercentage: 15,
      bodyFatMethod: 'navy',
    });

    const withoutBf: ProgressEntryRow = {
      ...withBf,
      body_fat_percentage: null,
      body_fat_method: null,
    };
    const mapped = mapProgressEntryRow(withoutBf);
    expect(mapped).toEqual({
      id: 'p-1',
      loggedDate: '2024-03-10',
      weightKg: 70.5,
    });
    expect('bodyFatPercentage' in mapped).toBe(false);
    expect('bodyFatMethod' in mapped).toBe(false);
  });

  it('coerces missing optional write fields to null (canonical columns)', () => {
    const row = toProgressEntryRowWrite({
      userId: 'u-1',
      loggedDate: '2024-03-10',
      weightKg: 70,
    });
    expect(row).toEqual({
      user_id: 'u-1',
      logged_date: '2024-03-10',
      weight_kg: 70,
      body_fat_percentage: null,
      body_fat_method: null,
    });
  });
});

describe('macro target history mappers', () => {
  it('round-trips row -> domain and insert -> row', () => {
    const row: MacroTargetHistoryRow = {
      id: 'h-1',
      user_id: 'u-1',
      effective_date: '2024-03-10',
      calculation_weight_kg: 70,
      source: 'baseline',
      rolling_average_kg: null,
      calorie_multiplier: 16.8,
      protein_multiplier: 1,
      fat_multiplier: 0.4,
      calculated_calories: 2592.63312,
      calculated_protein_g: 154.3234,
      calculated_fat_g: 61.72936,
      calculated_carbs_g: 354.94382,
      created_at: '2024-03-10T00:00:00.000Z',
    };
    const domain = mapMacroTargetHistoryRow(row);
    expect(domain.source).toBe('baseline');
    expect(domain.calculationWeightKg).toBe(70);
    expect(domain.calculatedCalories).toBe(2592.63312);

    const write = toMacroTargetHistoryRowWrite({
      userId: 'u-1',
      effectiveDate: '2024-03-10',
      calculationWeightKg: 70,
      source: 'automatic_weekly_average',
      rollingAverageKg: 71.2,
      calorieMultiplier: 16.8,
      proteinMultiplier: 1,
      fatMultiplier: 0.4,
      calculatedCalories: 2592.63312,
      calculatedProteinG: 154.3234,
      calculatedFatG: 61.72936,
      calculatedCarbsG: 354.94382,
    });
    expect(write.user_id).toBe('u-1');
    expect(write.source).toBe('automatic_weekly_average');
    expect(write.rolling_average_kg).toBe(71.2);
    expect('id' in write).toBe(false);
    expect('created_at' in write).toBe(false);
  });
});
