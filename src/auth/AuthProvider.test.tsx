/**
 * Tests for AuthProvider.signUp resilience (Bug 1 fix; R2.1, R2.2, R3.1–3.3).
 *
 * The Supabase client is fully mocked so no network is touched. These tests
 * pin the key behavioral contract:
 *   (a) Edge Function unavailable + allowed domain + valid password → falls
 *       back to supabase.auth.signUp and resolves ok.
 *   (b) Disallowed domain → domain error, and neither the Edge Function nor the
 *       SDK sign-up is invoked.
 *   (c) Edge Function explicitly rejects → the real server error is surfaced and
 *       there is NO fallback to supabase.auth.signUp (authoritative path kept).
 *   (d) Fallback supabase.auth.signUp returns a genuine error (duplicate/weak
 *       password) → that specific message is surfaced (not the generic one).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';

const invoke = vi.fn();
const signUpFn = vi.fn();
const signInWithPassword = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn();
const signOut = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      onAuthStateChange: (...a: unknown[]) => onAuthStateChange(...a),
      signUp: (...a: unknown[]) => signUpFn(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
    functions: {
      invoke: (...a: unknown[]) => invoke(...a),
    },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return createElement(AuthProvider, null, children);
}

beforeEach(() => {
  invoke.mockReset();
  signUpFn.mockReset();
  signInWithPassword.mockReset();
  getSession.mockReset();
  onAuthStateChange.mockReset();
  signOut.mockReset();

  // Default session-restore behavior for the provider's mount effect.
  getSession.mockResolvedValue({ data: { session: null } });
  onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

async function renderAuth() {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe('AuthProvider.signUp resilience', () => {
  it('(a) falls back to supabase.auth.signUp when the Edge Function is unavailable', async () => {
    // Edge Function not deployed / unreachable: the invocation throws.
    invoke.mockRejectedValue(new Error('Failed to fetch'));
    // SDK sign-up succeeds with a session established.
    signUpFn.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    });

    const result = await renderAuth();

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signUp('person@gmail.com', 'password123');
    });

    expect(outcome).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(signUpFn).toHaveBeenCalledWith({
      email: 'person@gmail.com',
      password: 'password123',
    });
    expect(result.current.error).toBeNull();
  });

  it('(b) rejects a disallowed domain without calling the Edge Function or the SDK', async () => {
    const result = await renderAuth();

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signUp(
        'person@fakegmail.com',
        'password123',
      );
    });

    expect(outcome?.ok).toBe(false);
    expect(outcome?.error).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
    expect(signUpFn).not.toHaveBeenCalled();
  });

  it('(c) surfaces the real Edge Function rejection and does NOT fall back', async () => {
    // Deployed function explicitly rejects: FunctionsHttpError carries a
    // Response in `context` whose JSON body has a real server error message.
    const serverMessage = 'Email domain is not allowed by the server.';
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: serverMessage }) },
      },
    });

    const result = await renderAuth();

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signUp('person@gmail.com', 'password123');
    });

    expect(outcome).toEqual({ ok: false, error: serverMessage });
    expect(signUpFn).not.toHaveBeenCalled();
    expect(result.current.error).toBe(serverMessage);
  });

  it('(d) surfaces the genuine SDK error from the fallback (not the generic message)', async () => {
    invoke.mockRejectedValue(new Error('Failed to fetch'));
    const duplicateMessage = 'User already registered';
    signUpFn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: duplicateMessage },
    });

    const result = await renderAuth();

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signUp('person@gmail.com', 'password123');
    });

    expect(outcome).toEqual({ ok: false, error: duplicateMessage });
    expect(result.current.error).toBe(duplicateMessage);
    expect(result.current.error).not.toMatch(/temporarily unavailable/i);
  });

  it('(a2) after fallback sign-up with no session, attempts to establish one and still resolves ok', async () => {
    invoke.mockRejectedValue(new Error('Failed to fetch'));
    // Email-confirmation setup: no session returned by signUp.
    signUpFn.mockResolvedValue({
      data: { user: { id: 'u2' }, session: null },
      error: null,
    });
    signInWithPassword.mockResolvedValue({ error: null });

    const result = await renderAuth();

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signUp('person@gmail.com', 'password123');
    });

    expect(outcome).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'person@gmail.com',
      password: 'password123',
    });
  });
});
