/**
 * ReminderSettings — optional "Body Composition Check-In" reminders
 * (Task 16.1; R16.1–16.5).
 *
 * Honest by design. Reminders are OFF by default and require BOTH an explicit
 * user opt-in AND browser notification permission before they can be enabled
 * (R16.1). They are disableable at any time (R16.2).
 *
 * This app has NO notification backend and makes NO promise of reliable
 * background scheduled delivery (R16.3, R16.4). The copy states plainly that
 * the browser / PWA cannot guarantee background scheduled notifications and
 * that reminders are best-effort while the app is open. We do not secretly add
 * a backend.
 *
 * Permission handling (R16.5): permission is only ever requested on an explicit
 * user action. If the user has already denied permission we NEVER re-prompt —
 * instead we surface guidance to change it in the browser's site settings.
 *
 * This component is presentational with respect to persistence: it renders the
 * controls and calls `onEnable` / `onDisable`; the ProfileScreen performs the
 * actual write via the reminder_preferences hook.
 */
import { useState } from 'react';
import { BellRing } from 'lucide-react';

/** Default suggested cadence (design.md): tied to body-fat updates. */
export const DEFAULT_CHECK_IN_SCHEDULE = 'Sat 10 PM, Sun 9 AM';

type NotificationPermissionState = 'default' | 'granted' | 'denied';

type ReminderSettingsProps = {
  /** Current persisted opt-in state (OFF by default). */
  enabled: boolean;
  /** Current persisted cadence text (or null when unset). */
  checkInSchedule: string | null;
  /** Persist an opt-in with the chosen schedule. Called only after permission. */
  onEnable: (schedule: string) => void;
  /** Persist opt-out. */
  onDisable: () => void;
  /** True while a persistence write is in flight. */
  isBusy?: boolean;
};

/** Whether the Notification API exists in this environment. */
function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Read the current permission without prompting; 'default' when unsupported. */
function currentPermission(): NotificationPermissionState {
  if (!notificationsSupported()) return 'default';
  return Notification.permission as NotificationPermissionState;
}

export function ReminderSettings({
  enabled,
  checkInSchedule,
  onEnable,
  onDisable,
  isBusy = false,
}: ReminderSettingsProps) {
  const supported = notificationsSupported();
  const [permission, setPermission] = useState<NotificationPermissionState>(
    currentPermission(),
  );
  const [schedule, setSchedule] = useState(
    checkInSchedule ?? DEFAULT_CHECK_IN_SCHEDULE,
  );
  const [requesting, setRequesting] = useState(false);

  async function handleToggle() {
    if (isBusy || requesting) return;

    if (enabled) {
      // Turning OFF is always allowed and needs no permission (R16.2).
      onDisable();
      return;
    }

    // Turning ON requires notification permission.
    if (!supported) {
      // Nothing to prompt for; the guidance copy below explains the limit.
      return;
    }

    if (permission === 'granted') {
      onEnable(schedule.trim() || DEFAULT_CHECK_IN_SCHEDULE);
      return;
    }

    if (permission === 'denied') {
      // Already denied — NEVER re-prompt (R16.5). Guidance is shown below.
      return;
    }

    // permission === 'default': request exactly once, on this explicit action.
    setRequesting(true);
    try {
      const result = (await Notification.requestPermission()) as
        | NotificationPermissionState
        | undefined;
      const next = result ?? currentPermission();
      setPermission(next);
      if (next === 'granted') {
        onEnable(schedule.trim() || DEFAULT_CHECK_IN_SCHEDULE);
      }
    } finally {
      setRequesting(false);
    }
  }

  // Should the enable path be blocked (and the toggle disabled)?
  const blockedReason: string | null = enabled
    ? null
    : !supported
      ? 'This browser does not support notifications, so check-in reminders are unavailable here.'
      : permission === 'denied'
        ? 'Notifications are blocked for this app. To turn on reminders, allow notifications for this site in your browser settings, then return here.'
        : null;

  const toggleDisabled = isBusy || requesting || blockedReason !== null;

  return (
    <section
      aria-labelledby="reminders-heading"
      className="flex flex-col gap-4 rounded-card bg-white p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="reminders-heading"
            className="flex items-center gap-2 text-lg font-semibold text-brand-navy"
          >
            <BellRing aria-hidden="true" className="h-5 w-5 text-brand-navy" />
            Body Composition Check-In
          </h2>
          <p className="text-sm text-slate-500">
            Optional reminders to log your check-in. Off by default.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Body Composition Check-In reminders"
          onClick={() => void handleToggle()}
          disabled={toggleDisabled}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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

      {/* Honest capability note — shown always, never overclaiming (R16.3/16.4). */}
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Heads up: browsers and installed PWAs cannot guarantee background
        scheduled notifications. These reminders are best-effort and generally
        only appear while the app is open. We do not run a notification server.
      </p>

      {enabled ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Reminders are on
            {checkInSchedule ? (
              <>
                {' '}
                for <span className="font-medium">{checkInSchedule}</span>
              </>
            ) : null}
            . You can turn them off any time.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="font-medium text-brand-navy">
              Check-in schedule
            </span>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-base text-brand-navy"
              aria-label="Check-in schedule"
            />
          </label>
          {blockedReason ? (
            <p role="status" className="text-sm text-slate-500">
              {blockedReason}
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              Turning this on will ask your browser for notification permission.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
