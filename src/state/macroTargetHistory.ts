/**
 * Macro-target-history appending (Task 10.3; R6.7, R13.1–13.4).
 *
 * Pure helpers that decide WHEN an effective macro-target change has occurred
 * and BUILD the append-only history record for it. The actual write is done by
 * the data layer's `useAppendMacroTargetHistory` (insert-only) — this module
 * never mutates prior rows.
 *
 * An "effective target change" means the tuple that determines the daily macro
 * targets changed: the calculation weight (Concept D) and/or any macro
 * multiplier. Comparisons use full precision (no rounding), consistent with the
 * calculation layer.
 */
import type {
  MacroResult,
  MacroSettings,
  MacroTargetHistoryInsert,
  MacroTargetSource,
} from '../types';
import type { ActiveWeightSource } from './activeWeightSelector';

/**
 * The inputs that fully determine a set of macro targets. If two snapshots have
 * equal `calculationWeightKg` and equal multipliers, they yield identical
 * targets and no new history row is needed.
 */
export type EffectiveTargetSnapshot = {
  calculationWeightKg: number;
  macroSettings: MacroSettings;
};

/**
 * True when `next` produces different macro targets than `previous`. A null
 * `previous` (no prior target recorded) is always a change — the very first
 * target must be captured.
 */
export function isEffectiveTargetChange(
  previous: EffectiveTargetSnapshot | null,
  next: EffectiveTargetSnapshot,
): boolean {
  if (previous === null) {
    return true;
  }
  return (
    previous.calculationWeightKg !== next.calculationWeightKg ||
    previous.macroSettings.calorieMultiplier !==
      next.macroSettings.calorieMultiplier ||
    previous.macroSettings.proteinMultiplier !==
      next.macroSettings.proteinMultiplier ||
    previous.macroSettings.fatMultiplier !== next.macroSettings.fatMultiplier
  );
}

/**
 * What triggered the (potential) target change. Maps directly onto the DB
 * `source` enum via {@link sourceForTrigger}.
 *   - `initial_baseline`        -> 'baseline'
 *   - `manual_baseline_change`  -> 'manual_baseline_change'
 *   - `automatic_weekly_average`-> 'automatic_weekly_average'
 *   - `macro_settings_change`   -> 'macro_settings_change'
 */
export type MacroChangeTrigger =
  | 'initial_baseline'
  | 'manual_baseline_change'
  | 'automatic_weekly_average'
  | 'macro_settings_change';

/** Translate a change trigger to the persisted `macro_target_history.source`. */
export function sourceForTrigger(trigger: MacroChangeTrigger): MacroTargetSource {
  switch (trigger) {
    case 'initial_baseline':
      return 'baseline';
    case 'manual_baseline_change':
      return 'manual_baseline_change';
    case 'automatic_weekly_average':
      return 'automatic_weekly_average';
    case 'macro_settings_change':
      return 'macro_settings_change';
  }
}

/**
 * Convenience mapping from the active-weight source + whether the change was a
 * macro-settings edit to the history `source` enum. Useful when appending after
 * `deriveMacroState`.
 */
export function resolveMacroTargetSource(params: {
  activeSource: ActiveWeightSource;
  isMacroSettingsChange: boolean;
  isInitial: boolean;
}): MacroTargetSource {
  if (params.isMacroSettingsChange) {
    return 'macro_settings_change';
  }
  if (params.activeSource === 'rolling_average') {
    return 'automatic_weekly_average';
  }
  if (params.isInitial) {
    return 'baseline';
  }
  return 'manual_baseline_change';
}

export type BuildMacroTargetHistoryParams = {
  userId: string;
  effectiveDate: string;
  source: MacroTargetSource;
  calculationWeightKg: number;
  rollingAverageKg: number | null;
  macroSettings: MacroSettings;
  macros: MacroResult;
};

/**
 * Build the content of a new append-only history row from a computed target.
 * The result is handed to `useAppendMacroTargetHistory` for insertion; this
 * function never touches existing rows.
 */
export function buildMacroTargetHistoryInsert(
  params: BuildMacroTargetHistoryParams,
): MacroTargetHistoryInsert {
  return {
    userId: params.userId,
    effectiveDate: params.effectiveDate,
    calculationWeightKg: params.calculationWeightKg,
    source: params.source,
    rollingAverageKg: params.rollingAverageKg,
    calorieMultiplier: params.macroSettings.calorieMultiplier,
    proteinMultiplier: params.macroSettings.proteinMultiplier,
    fatMultiplier: params.macroSettings.fatMultiplier,
    calculatedCalories: params.macros.totalCalories,
    calculatedProteinG: params.macros.proteinGrams,
    calculatedFatG: params.macros.fatGrams,
    calculatedCarbsG: params.macros.carbGrams,
  };
}
