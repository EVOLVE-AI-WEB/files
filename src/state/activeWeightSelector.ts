/**
 * Active_Weight_Selector (design.md — State Management Strategy; Active-weight
 * selection rule; Requirement 4.2–4.8).
 *
 * This is the single place where the *source* of the macro-calculation weight
 * (Concept D) is decided, and it lives in the STATE layer — never inside the
 * pure calculation functions. It is itself a pure function of explicit inputs:
 *
 *   - baselineWeightKg          (Concept A)
 *   - autoUpdateEnabled         (the Auto Macro Update preference)
 *   - qualifyingRollingAverageKg (Concept C, but ONLY when it qualifies)
 *   - previousActiveWeightKg    (the last selected active weight, if any)
 *
 * Note what is deliberately ABSENT from the inputs: the goal weight (Concept E)
 * and any individual daily weigh-in (Concept B). They are structurally unable
 * to become the active weight — the selector cannot see them. This enforces
 * Correctness_Properties P7 (single weigh-in never changes macros) and P11
 * (goal weight never becomes macro weight) by construction.
 *
 * Selection rule:
 *   IF NOT autoUpdateEnabled            -> active = baseline               (R4.3, P9)
 *   ELSE IF a qualifying average exists -> active = qualifying average     (R4.4, P10)
 *   ELSE                                -> retain previous active, status  (R4.5)
 */

export type ActiveWeightSource = 'baseline' | 'rolling_average' | 'retained_previous';

export type ActiveWeightSelectorInput = {
  /** Concept A — persistent reference weight. */
  baselineWeightKg: number;
  /** Auto Macro Update preference (OFF by default). */
  autoUpdateEnabled: boolean;
  /**
   * Concept C — the 7-day rolling average, passed here ONLY when it has been
   * determined to qualify (>= min measurements, <= once/period). Pass `null`
   * when it does not qualify or does not exist.
   */
  qualifyingRollingAverageKg: number | null;
  /** The previously selected active weight, or null on first selection. */
  previousActiveWeightKg: number | null;
};

export type ActiveWeightSelection = {
  /** Concept D — the only weight that may be fed to the macro formulas. */
  activeWeightKg: number;
  source: ActiveWeightSource;
  /** Human-readable status describing why this weight is active. */
  status: string;
};

/**
 * Select the active macro-calculation weight from explicit inputs.
 *
 * When Auto is ON but no qualifying average exists, the previous active weight
 * is retained unchanged (R4.5). If there is no previous active weight yet
 * (first run), we fall back to the baseline — which is the correct, allowed
 * default and never a goal weight or single weigh-in.
 */
export function selectActiveWeight(
  input: ActiveWeightSelectorInput,
): ActiveWeightSelection {
  const {
    baselineWeightKg,
    autoUpdateEnabled,
    qualifyingRollingAverageKg,
    previousActiveWeightKg,
  } = input;

  if (!autoUpdateEnabled) {
    return {
      activeWeightKg: baselineWeightKg,
      source: 'baseline',
      status: `Macros based on your baseline weight of ${baselineWeightKg} kg`,
    };
  }

  if (qualifyingRollingAverageKg !== null) {
    return {
      activeWeightKg: qualifyingRollingAverageKg,
      source: 'rolling_average',
      status: `Updated for this week based on your 7-day average weight of ${qualifyingRollingAverageKg} kg`,
    };
  }

  // Auto ON but no qualifying average: retain the previous active weight.
  if (previousActiveWeightKg !== null) {
    return {
      activeWeightKg: previousActiveWeightKg,
      source: 'retained_previous',
      status:
        'Not enough recent measurements to update this week — keeping your current macro weight',
    };
  }

  // No previous active weight exists yet: fall back to baseline (allowed).
  return {
    activeWeightKg: baselineWeightKg,
    source: 'retained_previous',
    status:
      'Not enough recent measurements to update yet — using your baseline weight',
  };
}
