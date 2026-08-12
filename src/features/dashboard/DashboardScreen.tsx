/**
 * DashboardScreen (Task 14.3; R12.8, R5.7).
 *
 * The at-a-glance home screen. It derives the current macro targets AND their
 * source via the pure state-layer `deriveMacroState` selector (never inside the
 * calc layer), then renders:
 *   - the macro-source banner (baseline vs. 7-day-average messaging, plus
 *     baseline / active weight / latest average / effective date / status),
 *   - an animated calorie ring with a counting-up calorie figure,
 *   - macro distribution bars,
 *   - a body-composition summary (BMI always; fat/lean mass only when a valid
 *     body-fat measurement exists — never fabricated).
 *
 * All numbers are display-rounded at render only; the underlying calculations
 * are untouched (R19).
 */
import { useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useProfile } from '../../data/useProfile';
import { useProgressEntries } from '../../data/useProgressEntries';
import { useMacroSettings } from '../../data/useMacroSettings';
import { calculateBMI, getBMICategory } from '../../calculations/bmi';
import {
  calculateFatMass,
  calculateLeanBodyMass,
} from '../../calculations/bodyComposition';
import type { ProgressEntry } from '../../types';
import {
  deriveMacroStateFromProfile,
  settingsOrDefaults,
} from '../shared/macroDerivation';
import { formatOneDecimal } from '../shared/format';
import { MacroBars } from '../shared/MacroBars';
import { MacroSourceBanner } from './MacroSourceBanner';
import { CalorieRing } from './CalorieRing';

/** The most recent progress entry carrying a valid body-fat percentage. */
function latestBodyFatEntry(
  entries: ProgressEntry[],
): ProgressEntry | null {
  let latest: ProgressEntry | null = null;
  for (const entry of entries) {
    if (
      typeof entry.bodyFatPercentage === 'number' &&
      Number.isFinite(entry.bodyFatPercentage)
    ) {
      if (latest === null || entry.loggedDate >= latest.loggedDate) {
        latest = entry;
      }
    }
  }
  return latest;
}

export function DashboardScreen() {
  const { user } = useAuth();
  const userId = user?.id;

  const profileQuery = useProfile(userId);
  const entriesQuery = useProgressEntries(userId);
  const settingsQuery = useMacroSettings(userId);

  const profile = profileQuery.data ?? null;
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);
  const macroSettings = settingsOrDefaults(settingsQuery.data);

  const macroState = useMemo(() => {
    if (!profile) return null;
    return deriveMacroStateFromProfile({
      profile,
      progressEntries: entries,
      macroSettings,
    });
  }, [profile, entries, macroSettings]);

  const isLoading =
    profileQuery.isLoading || entriesQuery.isLoading || settingsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md p-6 text-slate-500">Loading…</div>
    );
  }

  if (!profile || !macroState) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold text-brand-navy">Dashboard</h1>
        <p className="text-slate-600">
          Complete your profile setup to see your macro targets here.
        </p>
      </div>
    );
  }

  // Body-composition summary. BMI uses the active macro weight + profile height.
  const heightCm = profile.heightCm;
  const age = profile.age ?? 30;
  const bmi =
    heightCm && heightCm > 0
      ? calculateBMI(macroState.activeWeightKg, heightCm)
      : null;
  const bmiCategory = bmi !== null ? getBMICategory(bmi, age) : null;

  const bodyFatEntry = latestBodyFatEntry(entries);
  const bodyFat = bodyFatEntry?.bodyFatPercentage ?? null;
  // Fat/lean mass are derived only when a valid body-fat value exists.
  const fatMass = calculateFatMass(macroState.activeWeightKg, bodyFat);
  const leanMass = calculateLeanBodyMass(macroState.activeWeightKg, bodyFat);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Dashboard</h1>
      </header>

      <MacroSourceBanner
        source={macroState.activeSource}
        activeWeightKg={macroState.activeWeightKg}
        baselineWeightKg={macroState.baselineWeightKg}
        latestAverageKg={macroState.latestSevenDayAverageKg}
        effectiveDate={macroState.effectiveDate}
        status={macroState.status}
      />

      <section
        aria-label="Daily calorie target"
        className="flex flex-col items-center gap-3 rounded-card bg-white p-6 shadow-card"
      >
        <CalorieRing calories={macroState.macros.totalCalories} />
      </section>

      <section
        aria-labelledby="dashboard-macros-heading"
        className="flex flex-col gap-4 rounded-card bg-white p-5 shadow-card"
      >
        <h2
          id="dashboard-macros-heading"
          className="text-lg font-semibold text-brand-navy"
        >
          Macro targets
        </h2>
        <MacroBars macros={macroState.macros} headingId="dashboard-macros-heading" />
      </section>

      <section
        aria-labelledby="dashboard-bodycomp-heading"
        className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
      >
        <h2
          id="dashboard-bodycomp-heading"
          className="text-lg font-semibold text-brand-navy"
        >
          Body composition
        </h2>

        {bmi !== null && bmiCategory ? (
          <p className="text-sm text-slate-600">
            BMI:{' '}
            <span className="font-semibold text-brand-navy">
              {formatOneDecimal(bmi)}
            </span>{' '}
            {bmiCategory.appliesAdultCategories ? (
              <span className="text-slate-500">({bmiCategory.label})</span>
            ) : (
              <span className="text-slate-500">{bmiCategory.note}</span>
            )}{' '}
            — a screening measure, not a diagnosis.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Add your height to see your BMI.
          </p>
        )}

        {fatMass !== null && leanMass !== null ? (
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Fat mass</dt>
              <dd className="text-lg font-semibold tabular-nums text-brand-navy">
                {formatOneDecimal(fatMass)} kg
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Lean body mass</dt>
              <dd className="text-lg font-semibold tabular-nums text-brand-navy">
                {formatOneDecimal(leanMass)} kg
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">
            Log a body-fat measurement to see fat mass and lean body mass.
          </p>
        )}
      </section>
    </div>
  );
}
