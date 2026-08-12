/**
 * Tests for the sign-up client-side domain pre-check (Task 12.1).
 *
 * The pre-check is UX-only — the validate-signup-domain Edge Function is
 * authoritative — but it must block a doomed account-creation attempt for a
 * disallowed domain and surface a clear message. The Supabase client is mocked
 * so the module import never touches real env config.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../../auth/AuthProvider';
import { SignUpScreen } from './SignUpScreen';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

function makeAuthValue(
  overrides: Partial<AuthContextValue>,
): AuthContextValue {
  return {
    session: null,
    user: null,
    loading: false,
    error: null,
    signUp: vi.fn().mockResolvedValue({ ok: true }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function renderScreen(value: AuthContextValue) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter>
        <SignUpScreen />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('SignUpScreen domain pre-check', () => {
  it('blocks sign-up and shows an error for a disallowed (look-alike) domain', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({ ok: true });
    renderScreen(makeAuthValue({ signUp }));

    await user.type(screen.getByLabelText('Email'), 'someone@fakegmail.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // The pre-check rejects, so signUp is never invoked...
    expect(signUp).not.toHaveBeenCalled();
    // ...and a field-level error is shown.
    expect(screen.getByText(/not permitted/i)).toBeInTheDocument();
  });

  it('invokes signUp for an allowed domain', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({ ok: true });
    renderScreen(makeAuthValue({ signUp }));

    await user.type(screen.getByLabelText('Email'), 'someone@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(signUp).toHaveBeenCalledWith('someone@gmail.com', 'password123');
  });

  it('blocks sign-up when the password is too short', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({ ok: true });
    renderScreen(makeAuthValue({ signUp }));

    await user.type(screen.getByLabelText('Email'), 'someone@gmail.com');
    await user.type(screen.getByLabelText('Password'), '123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
  });
});
