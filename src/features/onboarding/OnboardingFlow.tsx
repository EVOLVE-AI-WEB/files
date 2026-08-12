/**
 * OnboardingFlow (Task 13.1).
 *
 * First-time setup that establishes the baseline profile before the main app
 * is reachable. It:
 *   - collects required name / age / height / starting weight, with field-level
 *     validation that blocks completion (R3.1, R3.8);
 *   - offers a metric/imperial unit choice and persists CANONICAL units — kg
 *     and cm — converting imperial input via the shared conversion helpers
 *     (R3.2, R3.3);
 *   - accepts an optional goal weight (R3.4);
 *   - accepts an optional U.S. Navy body-fat setup (neck, waist, + hip for
 *     female) with a Skip option (R3.5);
 *   - sets Auto Macro Update OFF (R3.6), persists onboarding_completed = true,
 *     sets Baseline_Weight from the starting weight, and seeds the active macro
 *     weight to the baseline (Auto OFF => active = baseline) (R3.7, R4.3);
 *   - creates the initial macro_settings row with defaults if none exists.
 *
 * All persistence goes through the existing data hooks (useUpsertProfile,
 * useMacroSettings/useUpsertMacroSettings), so RLS scoping and cache
 * invalidation are handled centrally.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProfileWrite, Sex, Unit } from '../../types';
import { CONFIG } from '../../config';
import { inchesToCm, lbToKg } from '../../calculations/conversions';
import {
  validateGoalWeight,
  validateNavyMeasurements,
} from '../../validation/validators';
import { useAuth } from '../../auth/AuthProvider';
import { useUpsertProfile } from '../../data/useProfile';
import {
  useMacroSettings,
  useUpsertMacroSettings,
} from '../../data/useMacroSettings';
import { AuthField } from '../auth/AuthField';

type StepKey = 'units' | 'details' | 'goal' | 'navy';
const STEP_ORDER: StepKey[] = ['units', 'details', 'goal', 'navy'];

/** Parse a possibly-empty input string to a finite number, or null. */
function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function OnboardingFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;

  const upsertProfile = useUpsertProfile(userId);
  const macroSettingsQuery = useMacroSettings(userId);
  const upsertMacroSettings = useUpsertMacroSettings(userId);

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEP_ORDER[stepIndex];

  // Preferences
  const [unit, setUnit] = useState<Unit>('metric');
  const [sex, setSex] = useState<Sex>('male');

  // Required details
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [heightCmInput, setHeightCmInput] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [startWeight, setStartWeight] = useState('');

  // Optional
  const [goalWeight, setGoalWeight] = useState('');
  const [neck, setNeck] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isImperial = unit === 'imperial';

  // --- Canonical (kg / cm) conversions from the raw inputs ------------------
  const heightCm = useMemo<number | null>(() => {
    if (isImperial) {
      const ft = parseNum(heightFt) ?? 0;
      const inch = parseNum(heightIn) ?? 0;
      if (ft === 0 && inch === 0) return null;
      return inchesToCm(ft * 12 + inch);
    }
    return parseNum(heightCmInput);
  }, [isImperial, heightFt, heightIn, heightCmInput]);

  const baselineWeightKg = useMemo<number | null>(() => {
    const raw = parseNum(startWeight);
    if (raw === null) return null;
    return isImperial ? lbToKg(raw) : raw;
  }, [isImperial, startWeight]);

  const goalWeightKg = useMemo<number | null>(() => {
    const raw = parseNum(goalWeight);
    if (raw === null) return null;
    return isImperial ? lbToKg(raw) : raw;
  }, [isImperial, goalWeight]);

  /** Convert a measurement input (inches when imperial) to canonical cm. */
  function toCanonicalCm(raw: number | null): number | null {
    if (raw === null) return null;
    return isImperial ? inchesToCm(raw) : raw;
  }

  const navyProvided = useMemo(() => {
    const fields = [neck, waist, ...(sex === 'female' ? [hip] : [])];
    return fields.some((f) => f.trim() !== '');
  }, [neck, waist, hip, sex]);

  // --- Validation -----------------------------------------------------------
  function validateDetails(): Record<string, string> {
    const next: Record<string, string> = {};

    if (name.trim() === '') {
      next.name = 'Name is required';
    }

    const ageNum = parseNum(age);
    if (ageNum === null) {
      next.age = 'Age is required';
    } else if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 129) {
      next.age = 'Enter a valid age between 1 and 129';
    }

    if (heightCm === null) {
      next.height = 'Height is required';
    } else if (heightCm <= 0) {
      next.height = 'Height must be greater than 0';
    }

    if (baselineWeightKg === null) {
      next.startWeight = 'Starting weight is required';
    } else if (baselineWeightKg <= 0) {
      next.startWeight = 'Starting weight must be greater than 0';
    }

    return next;
  }

  function validateGoalStep(): Record<string, string> {
    const next: Record<string, string> = {};
    if (goalWeight.trim() !== '') {
      if (goalWeightKg === null) {
        next.goalWeight = 'Enter a valid goal weight';
      } else if (baselineWeightKg !== null) {
        const result = validateGoalWeight(goalWeightKg, baselineWeightKg);
        if (!result.valid) {
          next.goalWeight = result.errors[0] ?? 'Invalid goal weight';
        }
      }
    }
    return next;
  }

  function validateNavyStep(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!navyProvided) return next;
    if (heightCm === null) {
      next.navy = 'Height is required for body-fat setup';
      return next;
    }
    const result = validateNavyMeasurements(sex, {
      heightCm,
      neckCm: toCanonicalCm(parseNum(neck)) ?? NaN,
      waistCm: toCanonicalCm(parseNum(waist)) ?? NaN,
      hipCm: sex === 'female' ? toCanonicalCm(parseNum(hip)) ?? NaN : undefined,
    });
    if (!result.valid) {
      next.navy = result.errors.join(' ');
    }
    return next;
  }

  // --- Navigation -----------------------------------------------------------
  function goNext() {
    setSubmitError(null);
    if (step === 'details') {
      const detailErrors = validateDetails();
      setErrors(detailErrors);
      if (Object.keys(detailErrors).length > 0) return;
    }
    if (step === 'goal') {
      const goalErrors = validateGoalStep();
      setErrors(goalErrors);
      if (Object.keys(goalErrors).length > 0) return;
    }
    setErrors({});
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  }

  function goBack() {
    setSubmitError(null);
    setErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  // --- Completion -----------------------------------------------------------
  async function complete(includeNavy: boolean) {
    if (submitting) return;
    if (!userId) {
      setSubmitError('You must be signed in to complete onboarding.');
      return;
    }

    // Final guard: required details must still be valid.
    const detailErrors = validateDetails();
    if (Object.keys(detailErrors).length > 0) {
      setErrors(detailErrors);
      setStepIndex(STEP_ORDER.indexOf('details'));
      return;
    }

    const goalErrors = validateGoalStep();
    if (Object.keys(goalErrors).length > 0) {
      setErrors(goalErrors);
      setStepIndex(STEP_ORDER.indexOf('goal'));
      return;
    }

    let navyValues: {
      neckCm: number;
      waistCm: number;
      hipCm: number | null;
    } | null = null;

    if (includeNavy && navyProvided) {
      const navyErrors = validateNavyStep();
      if (Object.keys(navyErrors).length > 0) {
        setErrors(navyErrors);
        return;
      }
      navyValues = {
        neckCm: toCanonicalCm(parseNum(neck)) as number,
        waistCm: toCanonicalCm(parseNum(waist)) as number,
        hipCm: sex === 'female' ? (toCanonicalCm(parseNum(hip)) as number) : null,
      };
    }

    // baselineWeightKg / heightCm are non-null here (validateDetails passed).
    const baseline = baselineWeightKg as number;

    const write: ProfileWrite = {
      userId,
      name: name.trim(),
      age: parseNum(age) as number,
      biologicalSex: sex,
      preferredUnit: unit,
      heightCm: heightCm as number,
      baselineWeightKg: baseline,
      // Auto Macro Update OFF => active macro weight starts at the baseline.
      activeMacroWeightKg: baseline,
      autoMacroUpdateEnabled: false,
      onboardingCompleted: true,
    };

    if (goalWeightKg !== null) {
      write.goalWeightKg = goalWeightKg;
      write.goalStartWeightKg = baseline;
      write.goalCreatedAt = new Date().toISOString();
    }

    if (navyValues) {
      write.neckCm = navyValues.neckCm;
      write.waistCm = navyValues.waistCm;
      write.hipCm = navyValues.hipCm;
    }

    setSubmitting(true);
    try {
      await upsertProfile.mutateAsync(write);

      // Seed default macro settings only when the user has none yet.
      if (!macroSettingsQuery.data) {
        await upsertMacroSettings.mutateAsync({
          userId,
          calorieMultiplier: CONFIG.DEFAULT_CALORIE_MULTIPLIER,
          proteinMultiplier: CONFIG.DEFAULT_PROTEIN_MULTIPLIER,
          fatMultiplier: CONFIG.DEFAULT_FAT_MULTIPLIER,
        });
      }

      navigate('/', { replace: true });
    } catch {
      setSubmitError('Could not save your profile. Please try again.');
      setSubmitting(false);
    }
  }

  const weightUnitLabel = isImperial ? 'lb' : 'kg';
  const lengthUnitLabel = isImperial ? 'in' : 'cm';

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-brand-navy">Welcome to Evolve</h1>
        <p className="text-slate-600">
          Let&apos;s set up your baseline profile ({stepIndex + 1} of{' '}
          {STEP_ORDER.length}).
        </p>
      </header>

      {step === 'units' && (
        <section className="flex flex-col gap-4" aria-label="Unit system">
          <h2 className="text-lg font-semibold text-brand-navy">
            Preferred units
          </h2>
          <div className="flex gap-3" role="radiogroup" aria-label="Unit system">
            {(['metric', 'imperial'] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                onClick={() => setUnit(u)}
                className={`min-h-[48px] flex-1 rounded-xl border px-4 text-base font-medium capitalize ${
                  unit === u
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-slate-300 bg-white text-brand-navy'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <h2 className="mt-2 text-lg font-semibold text-brand-navy">
            Biological sex
          </h2>
          <div className="flex gap-3" role="radiogroup" aria-label="Biological sex">
            {(['male', 'female'] as Sex[]).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={sex === s}
                onClick={() => setSex(s)}
                className={`min-h-[48px] flex-1 rounded-xl border px-4 text-base font-medium capitalize ${
                  sex === s
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-slate-300 bg-white text-brand-navy'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'details' && (
        <section className="flex flex-col gap-4" aria-label="Your details">
          <h2 className="text-lg font-semibold text-brand-navy">Your details</h2>
          <AuthField
            label="Name"
            name="name"
            value={name}
            error={errors.name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <AuthField
            label="Age"
            name="age"
            inputMode="numeric"
            value={age}
            error={errors.age}
            onChange={(e) => setAge(e.target.value)}
            required
          />

          {isImperial ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-brand-navy">Height</span>
              <div className="flex gap-3">
                <AuthField
                  label="Feet"
                  name="heightFt"
                  inputMode="numeric"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                />
                <AuthField
                  label="Inches"
                  name="heightIn"
                  inputMode="decimal"
                  value={heightIn}
                  onChange={(e) => setHeightIn(e.target.value)}
                />
              </div>
              {errors.height ? (
                <p role="alert" className="text-sm text-red-600">
                  {errors.height}
                </p>
              ) : null}
            </div>
          ) : (
            <AuthField
              label={`Height (${lengthUnitLabel})`}
              name="height"
              inputMode="decimal"
              value={heightCmInput}
              error={errors.height}
              onChange={(e) => setHeightCmInput(e.target.value)}
              required
            />
          )}

          <AuthField
            label={`Starting weight (${weightUnitLabel})`}
            name="startWeight"
            inputMode="decimal"
            value={startWeight}
            error={errors.startWeight}
            onChange={(e) => setStartWeight(e.target.value)}
            required
          />
        </section>
      )}

      {step === 'goal' && (
        <section className="flex flex-col gap-4" aria-label="Goal weight">
          <h2 className="text-lg font-semibold text-brand-navy">
            Goal weight (optional)
          </h2>
          <p className="text-sm text-slate-500">
            A goal weight is a progress target only. It never affects your macro
            calculations.
          </p>
          <AuthField
            label={`Goal weight (${weightUnitLabel})`}
            name="goalWeight"
            inputMode="decimal"
            value={goalWeight}
            error={errors.goalWeight}
            onChange={(e) => setGoalWeight(e.target.value)}
          />
        </section>
      )}

      {step === 'navy' && (
        <section className="flex flex-col gap-4" aria-label="Body-fat setup">
          <h2 className="text-lg font-semibold text-brand-navy">
            Body-fat setup (optional)
          </h2>
          <p className="text-sm text-slate-500">
            Enter circumference measurements for a U.S. Navy body-fat estimate,
            or skip this step.
          </p>
          <AuthField
            label={`Neck (${lengthUnitLabel})`}
            name="neck"
            inputMode="decimal"
            value={neck}
            onChange={(e) => setNeck(e.target.value)}
          />
          <AuthField
            label={`Waist (${lengthUnitLabel})`}
            name="waist"
            inputMode="decimal"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
          />
          {sex === 'female' && (
            <AuthField
              label={`Hip (${lengthUnitLabel})`}
              name="hip"
              inputMode="decimal"
              value={hip}
              onChange={(e) => setHip(e.target.value)}
            />
          )}
          {errors.navy ? (
            <p role="alert" className="text-sm text-red-600">
              {errors.navy}
            </p>
          ) : null}
        </section>
      )}

      {submitError ? (
        <p role="alert" className="text-sm text-red-600">
          {submitError}
        </p>
      ) : null}

      {/* Step controls */}
      <div className="mt-2 flex items-center justify-between gap-3">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="min-h-[48px] rounded-xl border border-slate-300 px-4 text-base font-medium text-brand-navy disabled:opacity-60"
          >
            Back
          </button>
        ) : (
          <span />
        )}

        {step !== 'navy' ? (
          <button
            type="button"
            onClick={goNext}
            className="min-h-[48px] rounded-xl bg-brand-navy px-5 text-base font-semibold text-white"
          >
            Next
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void complete(false)}
              disabled={submitting}
              className="min-h-[48px] rounded-xl border border-slate-300 px-4 text-base font-medium text-brand-navy disabled:opacity-60"
            >
              Skip &amp; finish
            </button>
            <button
              type="button"
              onClick={() => void complete(true)}
              disabled={submitting}
              className="min-h-[48px] rounded-xl bg-brand-navy px-5 text-base font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Complete setup'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
