/**
 * Integration test — Task 18.2
 * Feature: macro-body-composition-calculator, Property 16: Deletion requires
 *          authorization & only via trusted boundary
 * Validates: Requirements 17.2, 17.4, 2.4
 *
 * There is NO live Supabase instance in this environment, so this test verifies
 * the P16 trusted-boundary contract deterministically and offline, in two parts:
 *
 *  (a) Client wrapper contract (R17.2, R17.4): with `supabase.functions.invoke`
 *      mocked, `useDeleteAccount` resolves ONLY on a verified `{ success: true }`
 *      and REJECTS (retryable, no premature success) on a transport error, a
 *      non-2xx body carrying an `error`, or a body missing `success: true`. The
 *      client only ever INVOKES the Edge Function and NEVER calls a direct
 *      auth-user delete API (`auth.admin.deleteUser`) itself — deletion is only
 *      possible at the service-role server boundary.
 *
 *  (b) Edge Function allowlist logic (R2.4 / P14 enforced at the trusted
 *      boundary): the exact `validateAllowedEmailDomain` rule used by the
 *      Edge Function `supabase/functions/validate-signup-domain/index.ts`
 *      accepts allowed domains and rejects look-alikes (gmail.co, fakegmail.com,
 *      gmail.com.example.com). The Edge Function runs in Deno and imports from
 *      esm.sh, so it cannot be imported into the Vitest (node) runtime; the rule
 *      below is REPLICATED verbatim and mirrors that file. Any change there must
 *      be mirrored here.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import fc from 'fast-check';
import { useDeleteAccount } from '../data/useDeleteAccount';

// ---------------------------------------------------------------------------
// Mocked Supabase client. We expose BOTH the Edge Function invoker AND a direct
// admin delete spy so we can prove the client wrapper only ever reaches the
// trusted boundary (functions.invoke) and NEVER attempts a direct auth-user
// delete itself (which the anon client could never authorize anyway — R17.2).
// ---------------------------------------------------------------------------
const invoke = vi.fn();
const adminDeleteUser = vi.fn();
const authDeleteUser = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invoke(...args),
    },
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => adminDeleteUser(...args),
      },
      // Some SDK surfaces expose a user-scoped delete; it must never be used.
      deleteUser: (...args: unknown[]) => authDeleteUser(...args),
    },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: 0 }, queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  invoke.mockReset();
  adminDeleteUser.mockReset();
  authDeleteUser.mockReset();
});

describe('Feature: macro-body-composition-calculator, Property 16: Deletion requires authorization & only via trusted boundary (client wrapper)', () => {
  it('resolves ONLY on a verified { success: true } from the Edge Function (R17.4)', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await result.current.mutateAsync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Deletion happened ONLY via the trusted Edge Function boundary...
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('delete-account-and-data', { body: {} });
    // ...never via a direct client-side auth-user delete (R17.2).
    expect(adminDeleteUser).not.toHaveBeenCalled();
    expect(authDeleteUser).not.toHaveBeenCalled();
  });

  it('rejects (no premature success) on a transport / function error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow();
    expect(adminDeleteUser).not.toHaveBeenCalled();
    expect(authDeleteUser).not.toHaveBeenCalled();
  });

  it('rejects (no premature success) on a 2xx body carrying an error', async () => {
    invoke.mockResolvedValue({
      data: { error: 'Deletion could not be verified; please retry.' },
      error: null,
    });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow(
      /could not be verified/i,
    );
  });

  it('rejects (no premature success) when success:true is absent', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow();
  });

  it('throws even when invoke itself throws (rejection is retryable, state unchanged)', async () => {
    invoke.mockRejectedValue(new Error('thrown transport failure'));
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow();
    expect(adminDeleteUser).not.toHaveBeenCalled();
    expect(authDeleteUser).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (b) Edge Function allowlist rule (P14 at the trusted boundary).
// Replicated VERBATIM from supabase/functions/validate-signup-domain/index.ts.
// Mirror any change to that file here.
// ---------------------------------------------------------------------------
const EDGE_ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
] as const;

function edgeValidateAllowedEmailDomain(
  email: unknown,
): { valid: boolean; reason?: string } {
  if (typeof email !== 'string') {
    return { valid: false, reason: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();

  const atCount = (trimmed.match(/@/g) ?? []).length;
  if (atCount !== 1) {
    return { valid: false, reason: 'Email must contain exactly one "@"' };
  }

  const atIndex = trimmed.lastIndexOf('@');
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (local.length === 0 || domain.length === 0) {
    return { valid: false, reason: 'Email is malformed' };
  }

  if (!(EDGE_ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain)) {
    return { valid: false, reason: `Email domain "${domain}" is not permitted` };
  }

  return { valid: true };
}

describe('Feature: macro-body-composition-calculator, Property 16: Edge Function enforces the email allowlist (P14 at trusted boundary, R2.4)', () => {
  const localArb = fc
    .string({ minLength: 1, maxLength: 12 })
    .filter((s) => !s.includes('@') && s.trim().length > 0);

  it('accepts every allowed domain, case-insensitively', () => {
    fc.assert(
      fc.property(
        localArb,
        fc.constantFrom(...EDGE_ALLOWED_EMAIL_DOMAINS),
        fc.boolean(),
        (local, domain, upper) => {
          const casedDomain = upper ? domain.toUpperCase() : domain;
          expect(
            edgeValidateAllowedEmailDomain(`${local}@${casedDomain}`).valid,
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects look-alike / superset domains (prefix or suffix affix)', () => {
    const affixArb = fc
      .string({ minLength: 1, maxLength: 8 })
      .filter((s) => /^[a-z0-9.]+$/i.test(s));
    fc.assert(
      fc.property(
        localArb,
        fc.constantFrom(...EDGE_ALLOWED_EMAIL_DOMAINS),
        affixArb,
        fc.boolean(),
        (local, domain, affix, prefix) => {
          const lookAlike = prefix ? `${affix}${domain}` : `${domain}.${affix}`;
          expect(
            edgeValidateAllowedEmailDomain(`${local}@${lookAlike}`).valid,
          ).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects the documented look-alikes explicitly', () => {
    expect(edgeValidateAllowedEmailDomain('a@gmail.co').valid).toBe(false);
    expect(edgeValidateAllowedEmailDomain('a@fakegmail.com').valid).toBe(false);
    expect(edgeValidateAllowedEmailDomain('a@gmail.com.example.com').valid).toBe(
      false,
    );
  });

  it('rejects malformed emails (not exactly one parseable "@")', () => {
    expect(edgeValidateAllowedEmailDomain('gmail.com').valid).toBe(false);
    expect(edgeValidateAllowedEmailDomain('a@@gmail.com').valid).toBe(false);
    expect(edgeValidateAllowedEmailDomain('a@b@gmail.com').valid).toBe(false);
    expect(edgeValidateAllowedEmailDomain('@gmail.com').valid).toBe(false);
    expect(edgeValidateAllowedEmailDomain('a@').valid).toBe(false);
    expect(edgeValidateAllowedEmailDomain(123).valid).toBe(false);
  });

  it('parses the domain after the FINAL "@" (matches the client rule / P14)', () => {
    expect(edgeValidateAllowedEmailDomain('  User@Gmail.COM  ').valid).toBe(
      true,
    );
  });
});
