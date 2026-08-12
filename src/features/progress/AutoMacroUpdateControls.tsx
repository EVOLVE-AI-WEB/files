/**
 * AutoMacroUpdateControls (Task 15.2; R12.1, R12.2, R12.6, R12.9).
 *
 * The opt-in/opt-out control for Auto Macro Update (OFF by default). It:
 *   - lets the user enable the feature (explicit opt-in) and, when enabling
 *     qualifies, the screen applies the qualifying 7-day average,
 *   - surfaces the qualification status reason (e.g. "Macro targets were not
 *     updated because only 2 weight measurements were recorded"),
 *   - and, on DISABLE, presents the two explicit choices required by R12.9:
 *       (a) return the active macro weight to the baseline, or
 *       (b) make the current active weight the NEW baseline — a deliberate,
 *           confirmed edit (a second confirmation click is required).
 *
 * This is presentational: it renders the choices and calls back into the
 * screen, which performs the persistence + append-only history writes.
 */
import { useState } from 'react';
import type { AutoUpdateQualification } from '../../types';
import { formatOneDecimal } from '../shared/format';

type AutoMacroUpdateControlsProps = {
  /** Current Auto Macro Update preference. */
  enabled: boolean;
  /** The latest qualification decision + reason (from isAutoMacroUpdateQualified). */
  qualification: AutoUpdateQualification;
  /** Concept D — the current active macro weight. */
  activeWeightKg: number;
  /** Concept A — the current baseline weight. */
  baselineWeightKg: number;
  /** Enable Auto Macro Update (explicit opt-in). */
  onEnable: () => void;
  /** Disable + return the active macro weight to the baseline. */
  onDisableReturnToBaseline: () => void;
  /** Disable + make the current active weight the new baseline (confirmed). */
  onDisableMakeCurrentBaseline: () => void;
  /** True while a persistence write is in flight. */
  isBusy?: boolean;
};

/** Build the human-readable qualification status line (R12.6). */
function qualificationMessage(q: AutoUpdateQualification): string {
  if (q.qualifies && q.rollingAverageKg !== null) {
    return `Your 7-day average of ${formatOneDecimal(q.rollingAverageKg)} kg (${q.measurementCount} ${q.measurementCount === 1 ? 'measurement' : 'measurements'}) qualifies for automatic weekly updates.`;
  }
  if (q.reason.toLowerCase().startsWith('already updated')) {
    return 'Macro targets were already updated for this period. The next update can apply next week.';
  }
  const was = q.measurementCount === 1 ? 'was' : 'were';
  return `Macro targets were not updated because only ${q.measurementCount} weight ${q.measurementCount === 1 ? 'measurement' : 'measurements'} ${was} recorded (at least ${q.minimumRequired} are needed in the last 7 days).`;
}

export function AutoMacroUpdateControls({
  enabled,
  qualification,
  activeWeightKg,
  baselineWeightKg,
  onEnable,
  onDisableReturnToBaseline,
  onDisableMakeCurrentBaseline,
  isBusy = false,
}: AutoMacroUpdateControlsProps) {
  // UI phase for the disable flow: idle -> choosing -> confirming (for baseline).
  const [choosing, setChoosing] = useState(false);
  const [confirmingBaseline, setConfirmingBaseline] = useState(false);

  function handleToggle() {
    if (isBusy) return;
    if (enabled) {
      // Turning OFF: present the two explicit choices instead of acting blindly.
      setChoosing(true);
      setConfirmingBaseline(false);
    } else {
      onEnable();
    }
  }

  function cancelDisable() {
    setChoosing(false);
    setConfirmingBaseline(false);
  }

  function returnToBaseline() {
    onDisableReturnToBaseline();
    cancelDisable();
  }

  function makeCurrentBaseline() {
    if (!confirmingBaseline) {
      setConfirmingBaseline(true);
      return;
    }
    onDisableMakeCurrentBaseline();
    cancelDisable();
  }

  return (
    <section
      aria-labelledby="auto-update-heading"
      className="flex flex-col gap-4 rounded-card bg-white p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="auto-update-heading"
            className="text-lg font-semibold text-brand-navy"
          >
            Auto Macro Update
          </h2>
          <p className="text-sm text-slate-500">
            Automatically update your macro weight from your qualifying 7-day
            average, at most once per week. Your baseline is never overwritten.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Auto Macro Update"
          onClick={handleToggle}
          disabled={isBusy}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            enabled ? 'bg-brand-navy' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        {enabled ? qualificationMessage(qualification) : 'Auto Macro Update is off. Your macros use your baseline weight.'}
      </p>

      {choosing ? (
        <div
          role="group"
          aria-label="Choose how to turn off Auto Macro Update"
          className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3"
        >
          <p className="text-sm font-medium text-brand-navy">
            Turning off Auto Macro Update. Choose what happens to your macro
            weight:
          </p>

          <button
            type="button"
            onClick={returnToBaseline}
            disabled={isBusy}
            className="min-h-[48px] rounded-xl border border-slate-300 px-4 text-left text-base font-medium text-brand-navy disabled:opacity-60"
          >
            Return to my baseline weight of {formatOneDecimal(baselineWeightKg)}{' '}
            kg
          </button>

          <button
            type="button"
            onClick={makeCurrentBaseline}
            disabled={isBusy}
            className={`min-h-[48px] rounded-xl px-4 text-left text-base font-medium disabled:opacity-60 ${
              confirmingBaseline
                ? 'bg-brand-navy text-white'
                : 'border border-slate-300 text-brand-navy'
            }`}
          >
            {confirmingBaseline
              ? `Confirm: set ${formatOneDecimal(activeWeightKg)} kg as my new baseline`
              : `Make my current weight (${formatOneDecimal(activeWeightKg)} kg) my new baseline`}
          </button>

          <button
            type="button"
            onClick={cancelDisable}
            disabled={isBusy}
            className="min-h-[44px] self-start text-sm font-medium text-slate-500 underline disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
}
