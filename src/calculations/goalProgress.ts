/**
 * Goal-progress calculation (design.md, Part II — Goal Progress).
 *
 * Pure and side-effect-free. Computes progress toward a goal weight:
 *   progressPercent = ((current - starting) / (goal - starting)) * 100
 * guarded against divide-by-zero when `starting == goal` (progressPercent then
 * becomes null and never throws). The display bar caps at 100% (displayPercent
 * clamped to [0,100]) while the underlying progressPercent value may exceed it.
 * The goal never changes macros, baseline, active weight, multipliers, or macro
 * history — this function only derives display values.
 *
 * _Requirements: 14.2, 14.3, 14.4, 14.5_
 */
import type { GoalProgress } from '../types';

/** Clamp a value to the inclusive [min, max] range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Derive goal progress from starting, current, and goal weights (all kg).
 * Follows the design pseudocode exactly.
 */
export function calculateGoalProgress(
  startingWeightKg: number,
  currentWeightKg: number,
  goalWeightKg: number,
): GoalProgress {
  const changeKg = currentWeightKg - startingWeightKg;
  const remainingKg = goalWeightKg - currentWeightKg;

  let progressPercent: number | null;
  let displayPercent: number;
  let status: GoalProgress['status'];

  if (startingWeightKg === goalWeightKg) {
    // Divide-by-zero guard: no defined denominator.
    progressPercent = null;
    if (currentWeightKg === goalWeightKg) {
      status = 'reached';
      displayPercent = 100;
    } else {
      status = 'undefined';
      displayPercent = 0;
    }
  } else {
    progressPercent =
      ((currentWeightKg - startingWeightKg) /
        (goalWeightKg - startingWeightKg)) *
      100;
    displayPercent = clamp(progressPercent, 0, 100);

    if (progressPercent >= 100) {
      status = 'exceeded';
    } else if (currentWeightKg === goalWeightKg) {
      status = 'reached';
    } else if (goalWeightKg > startingWeightKg) {
      status = 'gaining';
    } else {
      status = 'losing';
    }
  }

  return {
    startingWeightKg,
    currentWeightKg,
    goalWeightKg,
    changeKg,
    remainingKg,
    progressPercent,
    displayPercent,
    status,
  };
}
