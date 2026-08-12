/**
 * Tests for AccountDeletion — the Danger Zone (Task 16.2; R17.1, R17.5).
 *
 * Verifies the deliberate, verified-only deletion contract:
 *   - the destructive action requires an explicit step PLUS a type-to-confirm
 *     gate before `onDelete` can be invoked (R17.1);
 *   - a failed deletion shows a retryable error and does NOT reach the success
 *     path — the component keeps its state so the user can retry (R17.5).
 *
 * `onDelete` is a stub — no Supabase/network. (The parent ProfileScreen wires
 * `onDelete` to the verified Edge Function call and only tears down the session
 * after it resolves successfully.)
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountDeletion } from './AccountDeletion';

describe('AccountDeletion', () => {
  it('requires the type-to-confirm gate before invoking deletion', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(<AccountDeletion userEmail="user@gmail.com" onDelete={onDelete} />);

    // Step 1: reveal the confirmation UI.
    await user.click(
      screen.getByRole('button', { name: /delete account & data/i }),
    );

    const finalButton = screen.getByRole('button', {
      name: /permanently delete/i,
    });
    // Disabled until the confirmation word is typed.
    expect(finalButton).toBeDisabled();

    // Typing the wrong word keeps it disabled and never invokes deletion.
    const input = screen.getByLabelText(/type delete to confirm/i);
    await user.type(input, 'delete me');
    expect(finalButton).toBeDisabled();
    expect(onDelete).not.toHaveBeenCalled();

    // Typing the exact confirmation word arms and invokes deletion.
    await user.clear(input);
    await user.type(input, 'DELETE');
    expect(finalButton).toBeEnabled();
    await user.click(finalButton);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable error and never reports success on failure', async () => {
    const user = userEvent.setup();
    const onDelete = vi
      .fn()
      .mockRejectedValue(new Error('Deletion failed; please retry.'));

    render(<AccountDeletion onDelete={onDelete} />);

    await user.click(
      screen.getByRole('button', { name: /delete account & data/i }),
    );
    await user.type(screen.getByLabelText(/type delete to confirm/i), 'DELETE');
    await user.click(screen.getByRole('button', { name: /permanently delete/i }));

    // Error surfaced, retry affordance offered, state unchanged (still armed).
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/deletion failed/i),
    );
    expect(
      screen.getByRole('button', { name: /retry permanent deletion/i }),
    ).toBeInTheDocument();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
