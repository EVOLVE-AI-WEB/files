/**
 * AddWeightForm (Task 15.1; R10.1, R10.4, R10.5, R10.8, R11.7).
 *
 * Add or edit *today's* morning weight (required, positive) plus an optional
 * body-fat percentage (0–75). Submission goes through an upsert against
 * UNIQUE(user_id, logged_date), so when an entry already exists for the date
 * the form is pre-filled and the same submit path edits it in place instead of
 * inserting a duplicate (R10.4). The submit control is disabled while a write
 * is in flight, which — together with the data-layer's in-flight guard — blocks
 * rapid double-submits (R10.5). Manual body-fat entries are tagged with
 * body_fat_method = 'manual'.
 *
 * This is a presentational component: it validates with `validateProgressEntry`
 * and delegates persistence to the `onSubmit` callback supplied by the screen.
 */
import { useEffect, useRef, useState } from 'react';
import type { ProgressEntry } from '../../types';
import { validateProgressEntry } from '../../validation/validators';
import { AuthField } from '../auth/AuthField';
import { formatShortDate } from './chartData';

export type AddWeightSubmit = {
  weightKg: number;
  bodyFatPercentage: number | null;
};

type AddWeightFormProps = {
  /** ISO 'YYYY-MM-DD' date this form logs for (typically today). */
  loggedDate: string;
  /** Any existing entry for `loggedDate`; when present the form edits it. */
  existingEntry: ProgressEntry | null;
  /** Persist the entry (upsert). Resolves when the write settles. */
  onSubmit: (values: AddWeightSubmit) => Promise<unknown>;
  /** True while a write is in flight (disables the submit control). */
  isPending: boolean;
};

/** Parse a possibly-empty input string to a finite number, or null. */
function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function AddWeightForm({
  loggedDate,
  existingEntry,
  onSubmit,
  isPending,
}: AddWeightFormProps) {
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const seeded = useRef<string | null>(null);

  // Seed the form from an existing entry for this date (duplicate-date edit).
  // Re-seeds when the target date or the existing entry identity changes.
  useEffect(() => {
    const key = `${loggedDate}:${existingEntry?.id ?? 'new'}`;
    if (seeded.current === key) return;
    seeded.current = key;
    if (existingEntry) {
      setWeight(String(existingEntry.weightKg));
      setBodyFat(
        existingEntry.bodyFatPercentage != null
          ? String(existingEntry.bodyFatPercentage)
          : '',
      );
    } else {
      setWeight('');
      setBodyFat('');
    }
    setErrors([]);
    setSavedNote(null);
  }, [loggedDate, existingEntry]);

  const isEditing = existingEntry !== null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return; // rapid-submit guard (UI side)

    setSavedNote(null);
    const weightKg = parseNum(weight);
    const bodyFatPercentage = parseNum(bodyFat);

    const validation = validateProgressEntry({
      weightKg: weightKg ?? undefined,
      bodyFatPercentage: bodyFatPercentage ?? undefined,
    });
    if (!validation.valid || weightKg === null) {
      setErrors(
        validation.errors.length > 0 ? validation.errors : ['Weight is required'],
      );
      return;
    }
    setErrors([]);

    await onSubmit({ weightKg, bodyFatPercentage });
    setSavedNote(isEditing ? 'Updated today’s entry.' : 'Weight logged.');
  }

  return (
    <section
      aria-labelledby="add-weight-heading"
      className="flex flex-col gap-4 rounded-card bg-white p-5 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="add-weight-heading"
          className="text-lg font-semibold text-brand-navy"
        >
          Add today’s weight
        </h2>
        <p className="text-sm text-slate-500">
          {isEditing
            ? `Editing your entry for ${formatShortDate(loggedDate)}.`
            : `Logging for ${formatShortDate(loggedDate)}.`}
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <AuthField
          label="Weight (kg)"
          name="weight"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
        />
        <AuthField
          label="Body fat % (optional)"
          name="bodyFat"
          inputMode="decimal"
          value={bodyFat}
          onChange={(e) => setBodyFat(e.target.value)}
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="min-h-[48px] rounded-xl bg-brand-navy px-5 text-base font-semibold text-white disabled:opacity-60"
          >
            {isPending
              ? 'Saving…'
              : isEditing
                ? 'Update entry'
                : 'Log weight'}
          </button>
          {savedNote ? (
            <span className="text-sm text-slate-500">{savedNote}</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
