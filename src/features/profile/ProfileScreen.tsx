/**
 * ProfileScreen (Task 16).
 *
 * The real Profile screen (replacing the placeholder). It composes, in the
 * design's flow order (Profile: Baseline → … → Units/Theme → Reminders →
 * Account/Delete):
 *
 *   - a baseline / profile summary,
 *   - a Units & Theme section (a light stub here — full theming/units polish is
 *     Task 17),
 *   - the optional Body Composition Check-In reminder settings (Task 16.1), and
 *   - the account-deletion Danger Zone (Task 16.2),
 *   - plus a sign-out action.
 *
 * Reminder preferences persist via the reminder_preferences hook. Account
 * deletion invokes the trusted `delete-account-and-data` Edge Function and,
 * ONLY after verified success, clears the React Query cache + service-worker /
 * cache storage and signs out — routing then returns to /signin. On failure the
 * Danger Zone keeps its state and shows a retryable error (R17.5).
 *
 * _Requirements: 16.1–16.5, 17.1, 17.4, 17.5_
 */
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { useProfile } from '../../data/useProfile';
import {
  useReminderPreferences,
  useUpsertReminderPreferences,
} from '../../data/useReminderPreferences';
import { useDeleteAccount } from '../../data/useDeleteAccount';
import { formatKg } from '../shared/format';
import { ThemeToggle } from '../shell/ThemeToggle';
import { ReminderSettings } from './ReminderSettings';
import { AccountDeletion } from './AccountDeletion';

/**
 * Best-effort teardown of client-side storage after a VERIFIED server-side
 * deletion. Clears the Cache Storage entries and unregisters service workers so
 * no stale cached data lingers in the installed PWA. Never throws.
 */
async function clearClientStorage(): Promise<void> {
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // best-effort only
  }
  try {
    if (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      navigator.serviceWorker.getRegistrations
    ) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch {
    // best-effort only
  }
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const profileQuery = useProfile(userId);
  const reminderQuery = useReminderPreferences(userId);
  const upsertReminder = useUpsertReminderPreferences(userId);
  const deleteAccount = useDeleteAccount();

  const profile = profileQuery.data ?? null;
  const reminder = reminderQuery.data ?? null;
  const reminderEnabled = reminder?.enabled ?? false;
  const reminderSchedule = reminder?.checkInSchedule ?? null;

  function handleEnableReminders(schedule: string) {
    if (!userId) return;
    upsertReminder.mutate({ userId, enabled: true, checkInSchedule: schedule });
  }

  function handleDisableReminders() {
    if (!userId) return;
    upsertReminder.mutate({ userId, enabled: false });
  }

  /**
   * Verified deletion, then teardown. `mutateAsync` rejects on any unverified
   * result, so the cache clear + sign-out below run ONLY after real success.
   */
  async function handleDeleteAccount(): Promise<void> {
    await deleteAccount.mutateAsync();
    // Verified success only past this point (R17.4).
    await clearClientStorage();
    queryClient.clear();
    await signOut();
    // Unauthenticated state — <ProtectedRoute> now redirects to /signin.
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold text-brand-navy">Profile</h1>
        {user?.email ? (
          <p className="text-sm text-slate-500">Signed in as {user.email}</p>
        ) : null}
      </header>

      {/* Baseline / profile summary */}
      <section
        aria-labelledby="profile-summary-heading"
        className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
      >
        <h2
          id="profile-summary-heading"
          className="text-lg font-semibold text-brand-navy"
        >
          Your profile
        </h2>
        {profileQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : profile ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500">
            <div className="flex flex-col">
              <dt>Name</dt>
              <dd className="text-sm font-medium text-brand-navy">
                {profile.name || '—'}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt>Age</dt>
              <dd className="text-sm font-medium text-brand-navy">
                {profile.age ?? '—'}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt>Baseline weight</dt>
              <dd className="text-sm font-medium text-brand-navy">
                {profile.baselineWeightKg != null
                  ? formatKg(profile.baselineWeightKg)
                  : '—'}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt>Goal weight</dt>
              <dd className="text-sm font-medium text-brand-navy">
                {profile.goalWeightKg != null
                  ? formatKg(profile.goalWeightKg)
                  : 'Not set'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">
            Complete onboarding to set up your profile.
          </p>
        )}
      </section>

      {/* Units & theme (Task 17.2) */}
      <section
        aria-labelledby="units-theme-heading"
        className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-card"
      >
        <h2
          id="units-theme-heading"
          className="text-lg font-semibold text-brand-navy"
        >
          Units &amp; theme
        </h2>
        <p className="text-sm text-slate-600">
          Preferred units:{' '}
          <span className="font-medium text-brand-navy">
            {profile?.preferredUnit ?? 'metric'}
          </span>
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">Appearance</span>
          <ThemeToggle withLabel />
        </div>
      </section>

      {/* Reminders (Task 16.1) */}
      <ReminderSettings
        enabled={reminderEnabled}
        checkInSchedule={reminderSchedule}
        onEnable={handleEnableReminders}
        onDisable={handleDisableReminders}
        isBusy={upsertReminder.isPending}
      />

      {/* Sign out */}
      <section className="flex flex-col gap-2 rounded-card bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-brand-navy">Session</h2>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-[48px] w-fit rounded-xl bg-brand-navy px-5 text-base font-semibold text-white"
        >
          Sign out
        </button>
      </section>

      {/* Account deletion Danger Zone (Task 16.2) */}
      <AccountDeletion userEmail={user?.email} onDelete={handleDeleteAccount} />
    </div>
  );
}
