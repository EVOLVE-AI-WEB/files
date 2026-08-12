/**
 * CalculatorScreen (Task 14.1).
 *
 * The full calculator, wired to the pure calc/validation layer. Sections:
 *   - Personal Details      — age / sex / height / current weight (seeded from
 *                             the profile; feed BMI + body composition)
 *   - Body Measurements     — neck / waist / (hip) for the U.S. Navy estimate
 *   - Advanced Macro Settings — editable multipliers with Reset to Defaults and
 *                             Save (useMacroSettings / useUpsertMacroSettings)
 *   - Nutrition Results     — macros from the ACTIVE macro weight via
 *                             deriveMacroState (never a raw entry), with carb-
 *                             shortfall guidance
 *   - Macro Visualization   — distribution bars
 *   - Body Composition      — BMI + Navy body fat + fat/lean mass (only when a
 *                             valid body-fat result exists) + animated gauge
 *   - Methodology           — formulas, disclaimer, configurable-multiplier note
 *
 * Display rounding is applied only at render (R19); the pure calc layer is
 * never mutated. Navy inputs surface inline errors + non-blocking warnings.
 *
 * _Requirements: 6.1–6.6, 7.5, 8.5, 8.6, 8.7, 9.6, 19.2–19.5_
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { MacroSettings, Sex } from '../../types';
import { CONFIG } from '../../config';
import { cmToInches } from '../../calculations/conversions';
import { calculateBMI, getBMICategory } from '../../calculations/bmi';
import {
  calculateMaleNavyBodyFat,
  calculateFemaleNavyBodyFat,
} from '../../calculations/navy';
import {
  calculateFatMass,
  calculateLeanBodyMass,
} from '../../calculations/bodyComposition';
import {
  validateMacroSettings,
  validateNavyMeasurements,
} from '../../validation/validators';
import { useAuth } from '../../auth/AuthProvider';
import { useProfile } from '../../data/useProfile';
import { useProgressEntries } from '../../data/useProgressEntries';
import {
  useMacroSettings,
  useUpsertMacroSettings,
} from '../../data/useMacroSettings';
import { AuthField } from '../auth/AuthField';
import { MacroBars } from '../shared/MacroBars';
import { StaggerContainer, cardItemVariants } from '../shared/motion';
import {
  deriveMacroStateFromProfile,
  buildMacroSourceMessage,
} from '../shared/macroDerivation';
import { formatOneDecimal } from '../shared/format';
import { DISCLAIMER_TEXT, CALORIE_MULTIPLIER_NOTE } from '../shared/disclaimer';
import { NutritionResults } from './NutritionResults';
import { BodyFatGauge } from './BodyFatGauge';

const DEFAULT_SETTINGS: MacroSettings = {
  calorieMultiplier: CONFIG.DEFAULT_CALORIE_MULTIPLIER,
  proteinMultiplier: CONFIG.DEFAULT_PROTEIN_MULTIPLIER,
  fatMultiplier: CONFIG.DEFAULT_FAT_MULTIPLIER,
};

/** Parse a possibly-empty input string to a finite number, or null. */
function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function Card({
  title,
  children,
  labelledById,
}: {
  title: string;
  children: ReactNode;
  labelledById: string;
}) {
  return (
    <motion.section
      variants={cardItemVariants}
      aria-labelledby={labelledById}
      className="flex flex-col gap-4 rounded-card bg-white p-5 shadow-card"
    >
      <h2 id={labelledById} className="text-lg font-semibold text-brand-navy">
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

export function CalculatorScreen() {
  const { user } = useAuth();
  const userId = user?.id;

  const profileQuery = useProfile(userId);
  const entriesQuery = useProgressEntries(userId);
  const settingsQuery = useMacroSettings(userId);
  const upsertMacroSettings = useUpsertMacroSettings(userId);

  const profile = profileQuery.data ?? null;
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);

  // --- Editable personal details (seeded once from the profile) -------------
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [neck, setNeck] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const seededProfile = useRef(false);

  useEffect(() => {
    if (!profile || seededProfile.current) return;
    seededProfile.current = true;
    setSex(profile.biologicalSex ?? 'male');
    setAge(profile.age != null ? String(profile.age) : '');
    setHeightCm(profile.heightCm != null ? String(profile.heightCm) : '');
    setWeightKg(
      profile.baselineWeightKg != null ? String(profile.baselineWeightKg) : '',
    );
    setNeck(profile.neckCm != null ? String(profile.neckCm) : '');
    setWaist(profile.waistCm != null ? String(profile.waistCm) : '');
    setHip(profile.hipCm != null ? String(profile.hipCm) : '');
  }, [profile]);

  // --- Editable macro settings (seeded once from the settings row) ----------
  const [settings, setSettings] = useState<MacroSettings>(DEFAULT_SETTINGS);
  const seededSettings = useRef(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    if (seededSettings.current) return;
    if (settingsQuery.data) {
      seededSettings.current = true;
      setSettings({
        calorieMultiplier: settingsQuery.data.calorieMultiplier,
        proteinMultiplier: settingsQuery.data.proteinMultiplier,
        fatMultiplier: settingsQuery.data.fatMultiplier,
      });
    }
  }, [settingsQuery.data]);

  const settingsValidation = validateMacroSettings(settings);

  function updateSetting(key: keyof MacroSettings, raw: string) {
    setSavedNote(null);
    const n = parseNum(raw);
    setSettings((prev) => ({ ...prev, [key]: n ?? 0 }));
  }

  function resetToDefaults() {
    setSavedNote(null);
    setSettings(DEFAULT_SETTINGS);
  }

  async function saveSettings() {
    if (!userId || !settingsValidation.valid) return;
    try {
      await upsertMacroSettings.mutateAsync({ userId, ...settings });
      setSavedNote('Saved.');
    } catch {
      setSavedNote('Could not save. Please try again.');
    }
  }

  // --- Derived macros (ACTIVE macro weight, not the editable weight) --------
  const macroState = useMemo(() => {
    if (!profile) return null;
    return deriveMacroStateFromProfile({
      profile,
      progressEntries: entries,
      macroSettings: settings,
    });
  }, [profile, entries, settings]);

  // --- BMI (uses the editable current weight + height) ----------------------
  const weightNum = parseNum(weightKg);
  const heightNum = parseNum(heightCm);
  const ageNum = parseNum(age);
  const bmi =
    weightNum && weightNum > 0 && heightNum && heightNum > 0
      ? calculateBMI(weightNum, heightNum)
      : null;
  const bmiCategory =
    bmi !== null ? getBMICategory(bmi, ageNum ?? 30) : null;

  // --- U.S. Navy body fat ---------------------------------------------------
  const navyProvided =
    neck.trim() !== '' &&
    waist.trim() !== '' &&
    (sex === 'male' || hip.trim() !== '');

  const navy = useMemo(() => {
    if (!navyProvided || heightNum === null || heightNum <= 0) {
      return null;
    }
    const measurements = {
      heightCm: heightNum,
      neckCm: parseNum(neck) ?? NaN,
      waistCm: parseNum(waist) ?? NaN,
      hipCm: sex === 'female' ? parseNum(hip) ?? NaN : undefined,
    };
    const validation = validateNavyMeasurements(sex, measurements);
    let bodyFat: number | null = null;
    if (validation.valid) {
      const heightIn = cmToInches(measurements.heightCm);
      const neckIn = cmToInches(measurements.neckCm);
      const waistIn = cmToInches(measurements.waistCm);
      if (sex === 'male') {
        bodyFat = calculateMaleNavyBodyFat(heightIn, neckIn, waistIn);
      } else {
        const hipIn = cmToInches(measurements.hipCm as number);
        bodyFat = calculateFemaleNavyBodyFat(heightIn, neckIn, waistIn, hipIn);
      }
    }
    return { validation, bodyFat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navyProvided, heightNum, neck, waist, hip, sex]);

  const bodyFat = navy?.bodyFat ?? null;
  const compWeight = weightNum && weightNum > 0 ? weightNum : null;
  const fatMass =
    compWeight !== null ? calculateFatMass(compWeight, bodyFat) : null;
  const leanMass =
    compWeight !== null ? calculateLeanBodyMass(compWeight, bodyFat) : null;

  if (profileQuery.isLoading) {
    return <div className="mx-auto max-w-md p-6 text-slate-500">Loading…</div>;
  }

  if (!profile || profile.baselineWeightKg == null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold text-brand-navy">Calculator</h1>
        <p className="text-slate-600">
          Complete your profile setup to use the calculator.
        </p>
      </div>
    );
  }

  const sourceNote = macroState
    ? `${buildMacroSourceMessage(
        macroState.activeSource,
        macroState.activeWeightKg,
      )}. BMI and body-fat estimates below use the current weight you enter above.`
    : undefined;

  return (
    <StaggerContainer className="mx-auto flex max-w-md flex-col gap-5 p-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Calculator</h1>
      </header>

      {/* Personal Details */}
      <Card title="Personal Details" labelledById="calc-personal">
        <div
          className="flex gap-3"
          role="radiogroup"
          aria-label="Biological sex"
        >
          {(['male', 'female'] as Sex[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sex === s}
              onClick={() => setSex(s)}
              className={`min-h-[44px] flex-1 rounded-xl border px-4 text-base font-medium capitalize ${
                sex === s
                  ? 'border-brand-navy bg-brand-navy text-white'
                  : 'border-slate-300 bg-white text-brand-navy'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <AuthField
          label="Age (years)"
          name="age"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
        <AuthField
          label="Height (cm)"
          name="height"
          inputMode="decimal"
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
        />
        <AuthField
          label="Current weight (kg)"
          name="weight"
          inputMode="decimal"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
        />
      </Card>

      {/* Body Measurements */}
      <Card title="Body Measurements" labelledById="calc-measurements">
        <p className="text-sm text-slate-500">
          Circumference measurements for the U.S. Navy body-fat estimate.
        </p>
        <AuthField
          label="Neck (cm)"
          name="neck"
          inputMode="decimal"
          value={neck}
          onChange={(e) => setNeck(e.target.value)}
        />
        <AuthField
          label="Waist (cm)"
          name="waist"
          inputMode="decimal"
          value={waist}
          onChange={(e) => setWaist(e.target.value)}
        />
        {sex === 'female' ? (
          <AuthField
            label="Hip (cm)"
            name="hip"
            inputMode="decimal"
            value={hip}
            onChange={(e) => setHip(e.target.value)}
          />
        ) : null}

        {navy && !navy.validation.valid ? (
          <ul role="alert" className="flex flex-col gap-1">
            {navy.validation.errors.map((err) => (
              <li key={err} className="text-sm text-red-600">
                {err}
              </li>
            ))}
          </ul>
        ) : null}
        {navy && navy.validation.valid && navy.validation.warnings.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {navy.validation.warnings.map((warn) => (
              <li key={warn} className="text-sm text-amber-700">
                {warn}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* Advanced Macro Settings */}
      <Card title="Advanced Macro Settings" labelledById="calc-settings">
        <p className="text-sm text-slate-500">
          Multipliers are applied per pound of your active macro weight.
        </p>
        <AuthField
          label="Calorie multiplier (kcal/lb)"
          name="calorieMultiplier"
          inputMode="decimal"
          value={String(settings.calorieMultiplier)}
          onChange={(e) => updateSetting('calorieMultiplier', e.target.value)}
        />
        <AuthField
          label="Protein multiplier (g/lb)"
          name="proteinMultiplier"
          inputMode="decimal"
          value={String(settings.proteinMultiplier)}
          onChange={(e) => updateSetting('proteinMultiplier', e.target.value)}
        />
        <AuthField
          label="Fat multiplier (g/lb)"
          name="fatMultiplier"
          inputMode="decimal"
          value={String(settings.fatMultiplier)}
          onChange={(e) => updateSetting('fatMultiplier', e.target.value)}
        />

        {!settingsValidation.valid ? (
          <ul role="alert" className="flex flex-col gap-1">
            {settingsValidation.errors.map((err) => (
              <li key={err} className="text-sm text-red-600">
                {err}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={resetToDefaults}
            className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-base font-medium text-brand-navy"
          >
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={!settingsValidation.valid || upsertMacroSettings.isPending}
            className="min-h-[44px] rounded-xl bg-brand-navy px-5 text-base font-semibold text-white disabled:opacity-60"
          >
            {upsertMacroSettings.isPending ? 'Saving…' : 'Save'}
          </button>
          {savedNote ? (
            <span className="self-center text-sm text-slate-500">
              {savedNote}
            </span>
          ) : null}
        </div>
      </Card>

      {/* Nutrition Results */}
      {macroState ? (
        <Card title="Nutrition Results" labelledById="calc-nutrition">
          <NutritionResults macros={macroState.macros} sourceNote={sourceNote} />
        </Card>
      ) : null}

      {/* Macro Visualization */}
      {macroState ? (
        <Card title="Macro Visualization" labelledById="calc-visualization">
          <MacroBars
            macros={macroState.macros}
            headingId="calc-visualization"
          />
        </Card>
      ) : null}

      {/* Body Composition Results */}
      <Card title="Body Composition Results" labelledById="calc-bodycomp">
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
            Enter your height and current weight to see your BMI.
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
            Fat mass and lean body mass appear once a valid body-fat result is
            available.
          </p>
        )}

        <BodyFatGauge sex={sex} bodyFat={bodyFat} age={ageNum ?? 30} />
      </Card>

      {/* Methodology */}
      <Card title="Methodology" labelledById="calc-methodology">
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          <p>
            <span className="font-semibold text-brand-navy">Macros.</span>{' '}
            Calories = weight (lb) × calorie multiplier; protein and fat grams =
            weight (lb) × their multipliers; carbohydrates come from the
            remaining calories (÷ 4).
          </p>
          <p>
            <span className="font-semibold text-brand-navy">BMI.</span> weight
            (kg) ÷ height (m)². A screening measure only.
          </p>
          <p>
            <span className="font-semibold text-brand-navy">
              U.S. Navy body fat.
            </span>{' '}
            A circumference-based estimate computed on inches using log10.
          </p>
          <p className="text-slate-500">{CALORIE_MULTIPLIER_NOTE}</p>
          <p className="rounded-xl bg-slate-50 p-3 text-slate-500">
            {DISCLAIMER_TEXT}
          </p>
        </div>
      </Card>
    </StaggerContainer>
  );
}
