/**
 * Derived macro state (Task 10.1) — the state-layer selector that ties the
 * pure calculation functions together WITHOUT mutating any source of truth.
 *
 * It composes, as derived selectors:
 *   - calculateRollingWeightAverage  (Concept C, derived on read from entries)
 *   - isAutoMacroUpdateQualified     (once/period + >= min-measurements guard)
 *   - selectActiveWeight             (Active_Weight_Selector — chooses Concept D)
 *   - calculateMacros                (receives ONLY the selected active weight)
 *
 * Everything here is a pure function of its inputs. Recomputing after a
 * progress write naturally recomputes the rolling average (entries change)
 * while the baseline — an independent input — is passed through untouched
 * (R11.6, R12.5, R12.6, R10.6). The macro formulas never see the goal weight or
 * a raw single entry.
 */
import type {
  AutoUpdateQualification,
  MacroResult,
  MacroSettings,
  ProgressEntry,
  RollingAverageResult,
} from '../types';
import { CONFIG } from '../config';
import { calculateRollingWeightAverage } from '../calculations/rollingAverage';
import {
  isAutoMacroUpdateQualified,
  type AutoUpdatePeriod,
} from '../calculations/autoUpdate';
import { calculateMacros } from '../calculations/macros';
import {
  selectActiveWeight,
  type ActiveWeightSource,
} from './activeWeightSelector';

export type DeriveMacroStateInput = {
  /** Concept A — persistent reference weight (never mutated here). */
  baselineWeightKg: number;
  /** Auto Macro Update preference (OFF by default). */
  autoUpdateEnabled: boolean;
  /** Concept B — daily observations; the rolling average is derived from these. */
  progressEntries: ProgressEntry[];
  /** Validated macro multipliers. */
  macroSettings: MacroSettings;
  /** The date the derivation is "as of" (rolling-average end date). */
  endDate: string;
  /** The weekly update period + last-update stamp for the once/period guard. */
  updatePeriod: AutoUpdatePeriod;
  /** The previously persisted active weight (Concept D), or null. */
  previousActiveWeightKg: number | null;
  /** Override the minimum qualifying measurement count (defaults to CONFIG). */
  minimumMeasurements?: number;
};

export type MacroState = {
  /** Concept A — unchanged input, surfaced for the dashboard. */
  baselineWeightKg: number;
  /** Concept C — the latest 7-day rolling average result. */
  rollingAverage: RollingAverageResult;
  /** Convenience accessor for the latest 7-day average value (or null). */
  latestSevenDayAverageKg: number | null;
  /** The auto-update qualification decision + reason. */
  qualification: AutoUpdateQualification;
  /** Concept D — the selected active macro weight. */
  activeWeightKg: number;
  /** Where the active weight came from. */
  activeSource: ActiveWeightSource;
  /** The date this derivation is effective for. */
  effectiveDate: string;
  /** Human-readable macro-source status message. */
  status: string;
  /** Macros computed from the active weight (Concept D) only. */
  macros: MacroResult;
};

/**
 * Compute the full derived macro state. Pure and side-effect-free.
 */
export function deriveMacroState(input: DeriveMacroStateInput): MacroState {
  const {
    baselineWeightKg,
    autoUpdateEnabled,
    progressEntries,
    macroSettings,
    endDate,
    updatePeriod,
    previousActiveWeightKg,
    minimumMeasurements = CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS,
  } = input;

  // Concept C — derived on read; missing days ignored, never zero-filled.
  const rollingAverage = calculateRollingWeightAverage(
    progressEntries,
    endDate,
    CONFIG.ROLLING_WINDOW_DAYS,
  );

  // Qualification gate (>= min measurements, at most once per period).
  const qualification = isAutoMacroUpdateQualified(
    progressEntries,
    updatePeriod,
    minimumMeasurements,
  );

  // Only a QUALIFYING average may be handed to the selector as a candidate.
  const qualifyingRollingAverageKg = qualification.qualifies
    ? qualification.rollingAverageKg
    : null;

  const selection = selectActiveWeight({
    baselineWeightKg,
    autoUpdateEnabled,
    qualifyingRollingAverageKg,
    previousActiveWeightKg,
  });

  // Macro formulas receive ONLY the selected active weight (Concept D).
  const macros = calculateMacros(selection.activeWeightKg, macroSettings);

  return {
    baselineWeightKg,
    rollingAverage,
    latestSevenDayAverageKg: rollingAverage.averageKg,
    qualification,
    activeWeightKg: selection.activeWeightKg,
    activeSource: selection.source,
    effectiveDate: endDate,
    status: selection.status,
    macros,
  };
}
