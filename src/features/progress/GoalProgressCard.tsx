/**
 * GoalProgressCard (Task 15.3; R14.5, R14.6, R14.1).
 *
 * Renders goal-weight progress and lets the user set/edit their goal. The
 * progress bar is capped at 100% (`displayPercent`, clamped 0–100) while the
 * true underlying `progressPercent` is retained and shown in text, and the
 * status label (gaining / losing / reached / exceeded / undefined) is surfaced
 * as text — never conveyed by color alone (R20.6).
 *
 * IMPORTANT (R14.6): setting or changing the goal must NEVER touch macros,
 * baseline, active weight, multipliers, or macro history. This component only
 * persists the goal fields via the `onSaveGoal` callback the screen supplies
 * (which writes only goal_weight_kg / goal_start_weight_kg / goal_created_at).
 */
import { useState } from 'react';
import type { GoalProgress } from '../../types';
import { calculateGoalProgress } from '../../calculations/goalProgress';
import { validateGoalWeight } from '../../validation/validators';
import { formatOneDecimal } from '../shared/format';
import { AuthField } from '../auth/AuthField';

type GoalProgressCardProps = {
  goalWeightKg: number | null;
  goalStartWeightKg: number | null;
  /** Latest valid progress weight, falling back to baseline in the screen. */
  currentWeightKg: number | null;
  /** Persist the goal. `startKg` is the goal-start weight to anchor progress. */
  onSaveGoal: (goalKg: number, startKg: number) => Promise<unknown>;
  isSaving?: boolean;
};

const STATUS_LABEL: Record<GoalProgress['status'], string> = {
  gaining: 'Gaining toward your goal',
  losing: 'Trending toward your goal',
  reached: 'Goal reached',
  exceeded: 'Goal exceeded',
  undefined: 'No progress to show yet',
};

function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function GoalProgressCard({
  goalWeightKg,
  goalStartWeightKg,
  currentWeightKg,
  onSaveGoal,
  isSaving = false,
}: GoalProgressCardProps) {
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState(
    goalWeightKg != null ? String(goalWeightKg) : '',
  );
  const [errors, setErrors] = useState<string[]>([]);

  const startWeight = goalStartWeightKg ?? currentWeightKg;
  const goalProgress =
    goalWeightKg != null && currentWeightKg != null && startWeight != null
      ? calculateGoalProgress(startWeight, currentWeightKg, goalWeightKg)
      : null;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    const goalKg = parseNum(goalInput);
    // Anchor progress at the current weight when no start is recorded yet.
    const startKg = goalStartWeightKg ?? currentWeightKg ?? goalKg ?? 0;
    const validation = validateGoalWeight(goalKg ?? NaN, startKg);
    if (!validation.valid || goalKg === null) {
      setErrors(
        validation.errors.length > 0
          ? validation.errors
          : ['Goal weight is required'],
      );
      return;
    }
    setErrors([]);
    await onSaveGoal(goalKg, startKg);
    setEditing(false);
  }

  return (
    <section
      aria-labelledby="goal-progress-heading"
      className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="goal-progress-heading"
          className="text-lg font-semibold text-brand-navy"
        >
          Goal progress
        </h2>
        <button
          type="button"
          onClick={() => {
            setGoalInput(goalWeightKg != null ? String(goalWeightKg) : '');
            setErrors([]);
            setEditing((v) => !v);
          }}
          className="min-h-[44px] text-sm font-medium text-brand-navy underline"
        >
          {editing ? 'Cancel' : goalWeightKg != null ? 'Edit goal' : 'Set goal'}
        </button>
      </div>

      {editing ? (
        <form className="flex flex-col gap-3" onSubmit={handleSave} noValidate>
          <AuthField
            label="Goal weight (kg)"
            name="goalWeight"
            inputMode="decimal"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            required
          />
          {errors.length > 0 ? (
            <ul role="alert" className="flex flex-col gap-1">
              {errors.map((err) => (
                <li key={err} className="text-sm text-red-600">
                  {err}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-slate-400">
            Changing your goal only affects this progress display — never your
            macros, baseline, or history.
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-[48px] w-fit rounded-xl bg-brand-navy px-5 text-base font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save goal'}
          </button>
        </form>
      ) : goalProgress && goalWeightKg != null ? (
        <>
          <div className="flex items-baseline justify-between text-sm text-slate-600">
            <span>
              Current:{' '}
              <span className="font-semibold text-brand-navy">
                {formatOneDecimal(goalProgress.currentWeightKg)} kg
              </span>
            </span>
            <span>
              Goal:{' '}
              <span className="font-semibold text-brand-navy">
                {formatOneDecimal(goalWeightKg)} kg
              </span>
            </span>
          </div>

          <div
            className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(goalProgress.displayPercent)}
            aria-label="Goal progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${goalProgress.displayPercent}%` }}
            />
          </div>

          <p className="text-sm font-medium text-brand-navy">
            {STATUS_LABEL[goalProgress.status]}
          </p>
          <p className="text-xs text-slate-500">
            {goalProgress.progressPercent === null
              ? 'Your start and goal weights are equal, so there is no percentage to show.'
              : `${formatOneDecimal(goalProgress.progressPercent)}% of the way there${
                  goalProgress.progressPercent > 100
                    ? ' (bar capped at 100%)'
                    : ''
                }.`}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Set a goal weight to track your progress toward it.
        </p>
      )}
    </section>
  );
}
