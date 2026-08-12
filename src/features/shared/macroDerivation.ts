/**
 * Screen-facing helpers that adapt persisted profile/entries/settings into the
 * pure state-layer `deriveMacroState` selector, plus the human-readable
 * macro-source message (R12.8).
 *
 * These live in the feature layer (not the pure calc/state layer) because they
 * deal with wall-clock "today" and default fallbacks. `deriveMacroState` itself
 * remains a pure function of explicit inputs.
 */
import type {
  MacroSettings,
  Profile,
  ProgressEntry,
} from '../../types';
import { CONFIG } from '../../config';
import {
  deriveMacroState,
  type DeriveMacroStateInput,
  type MacroState,
} from '../../state/macroState';
import type { ActiveWeightSource } from '../../state/activeWeightSelector';
import { formatOneDecimal } from './format';

/** Today's date as an ISO 'YYYY-MM-DD' string (local calendar day). */
export function todayIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** ISO date `days` calendar days before `endDate` (inclusive-window helper). */
export function isoDaysBefore(endDate: string, days: number): string {
  const ms = Date.parse(`${endDate}T00:00:00Z`);
  const shifted = new Date(ms - days * 86_400_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The macro multipliers, falling back to the CONFIG defaults when absent. */
export function settingsOrDefaults(
  settings: MacroSettings | null | undefined,
): MacroSettings {
  return {
    calorieMultiplier:
      settings?.calorieMultiplier ?? CONFIG.DEFAULT_CALORIE_MULTIPLIER,
    proteinMultiplier:
      settings?.proteinMultiplier ?? CONFIG.DEFAULT_PROTEIN_MULTIPLIER,
    fatMultiplier: settings?.fatMultiplier ?? CONFIG.DEFAULT_FAT_MULTIPLIER,
  };
}

/**
 * Build the pure `deriveMacroState` input from persisted data. Returns null
 * when there is no baseline weight yet (the macros cannot be computed and the
 * screen should show an onboarding-style empty state instead).
 */
export function buildDeriveInput(params: {
  profile: Profile;
  progressEntries: ProgressEntry[];
  macroSettings: MacroSettings;
  today?: string;
}): DeriveMacroStateInput | null {
  const { profile, progressEntries, macroSettings } = params;
  if (profile.baselineWeightKg == null) {
    return null;
  }
  const endDate = params.today ?? todayIso();
  return {
    baselineWeightKg: profile.baselineWeightKg,
    autoUpdateEnabled: profile.autoMacroUpdateEnabled,
    progressEntries,
    macroSettings,
    endDate,
    updatePeriod: {
      start: isoDaysBefore(endDate, CONFIG.ROLLING_WINDOW_DAYS - 1),
      end: endDate,
      lastUpdatedAt: profile.lastAutoMacroUpdateAt,
    },
    previousActiveWeightKg: profile.activeMacroWeightKg,
  };
}

/**
 * Convenience: derive the full macro state directly from persisted data, or
 * null when no baseline exists.
 */
export function deriveMacroStateFromProfile(params: {
  profile: Profile;
  progressEntries: ProgressEntry[];
  macroSettings: MacroSettings;
  today?: string;
}): MacroState | null {
  const input = buildDeriveInput(params);
  return input ? deriveMacroState(input) : null;
}

/**
 * Build the macro-source banner message (R12.8), distinguishing baseline-
 * sourced macros from 7-day-average-sourced macros. The weight is rounded to
 * one decimal for display (R19.4) while the underlying calc is untouched.
 */
export function buildMacroSourceMessage(
  source: ActiveWeightSource,
  activeWeightKg: number,
): string {
  const weight = formatOneDecimal(activeWeightKg);
  if (source === 'rolling_average') {
    return `Updated for this week based on your 7-day average weight of ${weight} kg`;
  }
  if (source === 'retained_previous') {
    return `Macros based on your current macro weight of ${weight} kg`;
  }
  return `Macros based on your baseline weight of ${weight} kg`;
}
