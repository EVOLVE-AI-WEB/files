/**
 * Tests for ReminderSettings (Task 16.1; R16.1, R16.3, R16.4, R16.5).
 *
 * Verifies the honest, opt-in-only behaviour:
 *   - reminders are OFF by default (the switch reflects `enabled=false`);
 *   - the honest capability note is always shown (no overclaiming);
 *   - when notification permission was previously DENIED, turning reminders on
 *     shows guidance and NEVER re-prompts (no requestPermission call, no opt-in);
 *   - with permission not yet decided, an explicit toggle requests permission
 *     once and opts in only when it is granted.
 *
 * The Notification API is stubbed on `window` per-test (jsdom has none). No
 * hooks or Supabase are involved — the component is driven by props/callbacks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderSettings } from './ReminderSettings';

type StubNotification = {
  permission: 'default' | 'granted' | 'denied';
  requestPermission: ReturnType<typeof vi.fn>;
};

function stubNotification(stub: StubNotification | null): void {
  if (stub === null) {
    delete (window as unknown as { Notification?: unknown }).Notification;
    return;
  }
  (window as unknown as { Notification: unknown }).Notification = stub;
}

afterEach(() => {
  stubNotification(null);
  vi.restoreAllMocks();
});

describe('ReminderSettings', () => {
  it('is OFF by default and always shows the honest capability note', () => {
    render(
      <ReminderSettings
        enabled={false}
        checkInSchedule={null}
        onEnable={vi.fn()}
        onDisable={vi.fn()}
      />,
    );

    const toggle = screen.getByRole('switch', {
      name: /body composition check-in reminders/i,
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByText(/cannot guarantee background scheduled notifications/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/we do not run a notification server/i),
    ).toBeInTheDocument();
  });

  it('does not re-prompt after a prior denial and shows guidance', async () => {
    const requestPermission = vi.fn();
    stubNotification({ permission: 'denied', requestPermission });
    const onEnable = vi.fn();
    const user = userEvent.setup();

    render(
      <ReminderSettings
        enabled={false}
        checkInSchedule={null}
        onEnable={onEnable}
        onDisable={vi.fn()}
      />,
    );

    // Guidance to change the setting in the browser is surfaced...
    expect(
      screen.getByText(/allow notifications for this site in your browser settings/i),
    ).toBeInTheDocument();

    // ...and attempting to toggle on must NOT re-prompt or opt in (R16.5).
    await user.click(
      screen.getByRole('switch', {
        name: /body composition check-in reminders/i,
      }),
    );
    expect(requestPermission).not.toHaveBeenCalled();
    expect(onEnable).not.toHaveBeenCalled();
  });

  it('requests permission once on explicit opt-in and enables when granted', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    stubNotification({ permission: 'default', requestPermission });
    const onEnable = vi.fn();
    const user = userEvent.setup();

    render(
      <ReminderSettings
        enabled={false}
        checkInSchedule={null}
        onEnable={onEnable}
        onDisable={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('switch', {
        name: /body composition check-in reminders/i,
      }),
    );

    expect(requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onEnable).toHaveBeenCalledTimes(1));
    // Opts in with the (default) schedule string.
    expect(onEnable).toHaveBeenCalledWith(expect.stringMatching(/\S/));
  });

  it('disabling when already on needs no permission and calls onDisable', async () => {
    const requestPermission = vi.fn();
    stubNotification({ permission: 'granted', requestPermission });
    const onDisable = vi.fn();
    const user = userEvent.setup();

    render(
      <ReminderSettings
        enabled
        checkInSchedule="Sat 10 PM"
        onEnable={vi.fn()}
        onDisable={onDisable}
      />,
    );

    await user.click(
      screen.getByRole('switch', {
        name: /body composition check-in reminders/i,
      }),
    );
    expect(onDisable).toHaveBeenCalledTimes(1);
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
