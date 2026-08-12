/**
 * ProgressScreen (Task 15).
 *
 * The real Progress screen (replacing the placeholder). It wires the persisted
 * data (profile, progress entries, macro settings, macro-target history) to the
 * presentational sub-components in the design's flow order:
 *
 *   Summary → Goal Progress → Add Today's Weight → 7-Day Average →
 *   Daily + Average Trend → Body Fat Trend → Fat/Lean Trends → History.
 *
 * The macro state (rolling average, qualification, active weight + source) is
 * derived via the pure `deriveMacroState` selector — never inside the calc
 * layer. All writes respect the five-concept separation:
 *   - logging a weigh-in upserts a progress entry and NEVER mutates baseline;
 *   - setting/editing the goal writes ONLY the goal fields (never macros /
 *     baseline / active / multipliers / history);
 *   - enabling Auto Macro Update applies a qualifying 7-day average and appends
 *     an `automatic_weekly_average` history row;
 *   - disabling offers the two explicit choices (return to baseline, or make
 *     the current weight the new baseline — the latter appends a
 *     `manual_baseline_change` history row).
 *
 * _Requirements: 10.1, 10.4, 10.5, 10.8, 11.5, 11.7, 12.1, 12.2, 12.6, 12.9,
 *  13.1, 13.2, 13.3, 14.5, 14.6, 15.1–15.6_
 */
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useProfile, useUpsertProfile } from '../../data/useProfile';
import {
  useProgressEntries,
  useUpsertProgressEntry,
} from '../../data/useProgressEntries';
import { useMacroSettings } from '../../data/useMacroSettings';
import {
  useMacroTargetHistory,
  useAppendMacroTargetHistory,
} from '../../data/useMacroTargetHistory';
import type { MacroTargetSource, ProgressEntry } from '../../types';
import { calculateMacros } from '../../calculations/macros';
import { buildMacroTargetHistoryInsert } from '../../state/macroTargetHistory';
import {
  deriveMacroStateFromProfile,
  settingsOrDefaults,
  todayIso,
} from '../shared/macroDerivation';
import { formatKg, formatOneDecimal } from '../shared/format';
import { StaggerContainer, StaggerItem } from '../shared/motion';
import { AddWeightForm, type AddWeightSubmit } from './AddWeightForm';
import { RollingAverageCard } from './RollingAverageCard';
import { AutoMacroUpdateControls } from './AutoMacroUpdateControls';
import { GoalProgressCard } from './GoalProgressCard';
import { MacroHistoryList } from './MacroHistoryList';
import { TrendRangeSelector } from './TrendRangeSelector';
import { WeightTrendChart } from './WeightTrendChart';
import { BodyFatTrendChart } from './BodyFatTrendChart';
import { FatLeanTrendChart } from './FatLeanTrendChart';
import {
  buildBodyCompSeries,
  buildWeightSeries,
  filterByRange,
  type TrendRange,
} from './chartData';

/** The latest valid progress weight (max logged_date), or null. */
function latestProgressWeight(entries: ProgressEntry[]): number | null {
  let latest: ProgressEntry | null = null;
  for (const entry of entries) {
    if (
      typeof entry.weightKg === 'number' &&
      Number.isFinite(entry.weightKg) &&
      entry.weightKg > 0
    ) {
      if (latest === null || entry.loggedDate > latest.loggedDate) {
        latest = entry;
      }
    }
  }
  return latest?.weightKg ?? null;
}

export function ProgressScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayIso();

  const profileQuery = useProfile(userId);
  const entriesQuery = useProgressEntries(userId);
  const settingsQuery = useMacroSettings(userId);
  const historyQuery = useMacroTargetHistory(userId);

  const upsertEntry = useUpsertProgressEntry(userId);
  const upsertProfile = useUpsertProfile(userId);
  const appendHistory = useAppendMacroTargetHistory(userId);

  const profile = profileQuery.data ?? null;
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);
  const macroSettings = settingsOrDefaults(settingsQuery.data);
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  const [range, setRange] = useState<TrendRange>('8wk');

  const macroState = useMemo(() => {
    if (!profile) return null;
    return deriveMacroStateFromProfile({
      profile,
      progressEntries: entries,
      macroSettings,
      today,
    });
  }, [profile, entries, macroSettings, today]);

  const weightSeries = useMemo(
    () => filterByRange(buildWeightSeries(entries), range, today),
    [entries, range, today],
  );
  const bodyCompSeries = useMemo(
    () => filterByRange(buildBodyCompSeries(entries), range, today),
    [entries, range, today],
  );

  const isLoading =
    profileQuery.isLoading || entriesQuery.isLoading || settingsQuery.isLoading;

  if (isLoading) {
    return <div className="mx-auto max-w-md p-6 text-slate-500">Loading…</div>;
  }

  if (!profile || !macroState || profile.baselineWeightKg == null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold text-brand-navy">Progress</h1>
        <p className="text-slate-600">
          Complete your profile setup to start tracking your progress.
        </p>
      </div>
    );
  }

  const baselineWeightKg = macroState.baselineWeightKg;
  const activeWeightKg = macroState.activeWeightKg;
  const currentWeightKg = latestProgressWeight(entries) ?? baselineWeightKg;
  const todayEntry = entries.find((e) => e.loggedDate === today) ?? null;
  const isBusy = upsertProfile.isPending || appendHistory.isPending;

  // --- Add / edit today's weight -------------------------------------------
  async function handleAddWeight(values: AddWeightSubmit) {
    if (!userId) return;
    await upsertEntry.submit({
      userId,
      loggedDate: today,
      weightKg: values.weightKg,
      bodyFatPercentage: values.bodyFatPercentage,
      // Tag manual body-fat entries; leave null when no body fat provided.
      bodyFatMethod: values.bodyFatPercentage !== null ? 'manual' : null,
    });
  }

  // --- Goal (writes ONLY goal fields; never macros/baseline/history) -------
  async function handleSaveGoal(goalKg: number, startKg: number) {
    if (!userId) return;
    await upsertProfile.mutateAsync({
      userId,
      goalWeightKg: goalKg,
      goalStartWeightKg: startKg,
      goalCreatedAt: new Date().toISOString(),
    });
  }

  /** Append a macro-target-history row for an effective target change. */
  async function appendTargetHistory(
    source: MacroTargetSource,
    calculationWeightKg: number,
    rollingAverageKg: number | null,
  ) {
    if (!userId) return;
    const macros = calculateMacros(calculationWeightKg, macroSettings);
    await appendHistory.mutateAsync(
      buildMacroTargetHistoryInsert({
        userId,
        effectiveDate: today,
        source,
        calculationWeightKg,
        rollingAverageKg,
        macroSettings,
        macros,
      }),
    );
  }

  // --- Auto Macro Update ----------------------------------------------------
  async function handleEnableAuto() {
    if (!userId || !macroState) return;
    const q = macroState.qualification;
    if (q.qualifies && q.rollingAverageKg !== null) {
      // Qualifying average: apply it, stamp the update, and record history.
      await upsertProfile.mutateAsync({
        userId,
        autoMacroUpdateEnabled: true,
        activeMacroWeightKg: q.rollingAverageKg,
        lastAutoMacroUpdateAt: new Date().toISOString(),
      });
      await appendTargetHistory(
        'automatic_weekly_average',
        q.rollingAverageKg,
        q.rollingAverageKg,
      );
    } else {
      // No qualifying average yet: just enable; active weight is retained.
      await upsertProfile.mutateAsync({
        userId,
        autoMacroUpdateEnabled: true,
      });
    }
  }

  async function handleReturnToBaseline() {
    if (!userId) return;
    await upsertProfile.mutateAsync({
      userId,
      autoMacroUpdateEnabled: false,
      activeMacroWeightKg: baselineWeightKg,
    });
  }

  async function handleMakeCurrentBaseline() {
    if (!userId) return;
    // Deliberate, confirmed baseline change: baseline + active become current.
    await upsertProfile.mutateAsync({
      userId,
      autoMacroUpdateEnabled: false,
      baselineWeightKg: activeWeightKg,
      activeMacroWeightKg: activeWeightKg,
    });
    await appendTargetHistory('manual_baseline_change', activeWeightKg, null);
  }

  return (
    <StaggerContainer className="mx-auto flex max-w-md flex-col gap-5 p-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Progress</h1>
      </header>

      {/* Summary */}
      <StaggerItem
        aria-labelledby="progress-summary-heading"
        className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
      >
        <h2
          id="progress-summary-heading"
          className="text-lg font-semibold text-brand-navy"
        >
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500">
          <div className="flex flex-col">
            <dt>Baseline</dt>
            <dd className="font-medium text-brand-navy">
              {formatKg(baselineWeightKg)}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt>Active macro weight</dt>
            <dd className="font-medium text-brand-navy">
              {formatKg(activeWeightKg)}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt>Latest 7-day average</dt>
            <dd className="font-medium text-brand-navy">
              {macroState.latestSevenDayAverageKg === null
                ? 'Not enough data'
                : formatKg(macroState.latestSevenDayAverageKg)}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt>Current weight</dt>
            <dd className="font-medium text-brand-navy">
              {formatOneDecimal(currentWeightKg)} kg
            </dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500">{macroState.status}</p>
      </StaggerItem>

      {/* Goal Progress */}
      <StaggerItem>
        <GoalProgressCard
          goalWeightKg={profile.goalWeightKg}
          goalStartWeightKg={profile.goalStartWeightKg}
          currentWeightKg={currentWeightKg}
          onSaveGoal={handleSaveGoal}
          isSaving={upsertProfile.isPending}
        />
      </StaggerItem>

      {/* Add Today's Weight */}
      <StaggerItem>
        <AddWeightForm
          loggedDate={today}
          existingEntry={todayEntry}
          onSubmit={handleAddWeight}
          isPending={upsertEntry.isPending}
        />
      </StaggerItem>

      {/* 7-Day Average */}
      <StaggerItem>
        <RollingAverageCard rollingAverage={macroState.rollingAverage} />
      </StaggerItem>

      {/* Auto Macro Update */}
      <StaggerItem>
        <AutoMacroUpdateControls
          enabled={profile.autoMacroUpdateEnabled}
          qualification={macroState.qualification}
          activeWeightKg={activeWeightKg}
          baselineWeightKg={baselineWeightKg}
          onEnable={() => void handleEnableAuto()}
          onDisableReturnToBaseline={() => void handleReturnToBaseline()}
          onDisableMakeCurrentBaseline={() => void handleMakeCurrentBaseline()}
          isBusy={isBusy}
        />
      </StaggerItem>

      {/* Trend charts share a single range selector */}
      <StaggerItem
        aria-label="Trend range"
        className="flex flex-col gap-2 rounded-card bg-white p-5 shadow-card"
      >
        <h2 className="text-lg font-semibold text-brand-navy">Trends</h2>
        <TrendRangeSelector value={range} onChange={setRange} />
      </StaggerItem>

      {/* Daily + Average Trend */}
      <StaggerItem>
        <WeightTrendChart
          points={weightSeries}
          baselineWeightKg={baselineWeightKg}
          activeWeightKg={activeWeightKg}
          goalWeightKg={profile.goalWeightKg}
        />
      </StaggerItem>

      {/* Body Fat Trend */}
      <StaggerItem>
        <BodyFatTrendChart points={bodyCompSeries} />
      </StaggerItem>

      {/* Fat / Lean Trends */}
      <StaggerItem>
        <FatLeanTrendChart points={bodyCompSeries} />
      </StaggerItem>

      {/* History */}
      <StaggerItem>
        <MacroHistoryList records={history} />
      </StaggerItem>
    </StaggerContainer>
  );
}
