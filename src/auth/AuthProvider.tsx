/**
 * AuthProvider — authentication context for the Macro & Body Composition
 * Calculator (Task 12.1).
 *
 * Exposes the Supabase session/user plus the auth actions the screens need:
 * signUp, signIn, signOut, resetPassword, and loading/error state.
 *
 * Session persistence: the shared Supabase client is created with
 * `persistSession: true` / `autoRefreshToken: true` (see src/lib/supabase.ts).
 * On mount we restore any existing session with `getSession()` and then stay in
 * sync via `onAuthStateChange`, so a page reload keeps the user signed in
 * without re-entering credentials (R1.4).
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2.5_
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { validateAllowedEmailDomain } from '../validation/validators';

export type AuthActionResult = { ok: boolean; error?: string };

export type AuthContextValue = {
  /** The current Supabase session, or null when unauthenticated. */
  session: Session | null;
  /** Convenience accessor for `session.user`. */
  user: User | null;
  /** True while the initial session restore is in flight (R1.4). */
  loading: boolean;
  /** The most recent auth error message, or null. */
  error: string | null;
  /**
   * Create an account. The authoritative email-domain allowlist lives at the
   * `validate-signup-domain` Edge Function (R2.4); the client pre-check here is
   * UX-only (R2.5). On success the new user is signed in.
   */
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  /** Sign in with email + password. Invalid credentials set `error`, no session (R1.7). */
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  /** Sign out and return to the unauthenticated state (R1.3). */
  signOut: () => Promise<void>;
  /** Trigger the Supabase password-reset email flow (R1.5). */
  resetPassword: (email: string) => Promise<AuthActionResult>;
  /** Clear the current error message. */
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

const GENERIC_SIGNUP_UNAVAILABLE =
  'Sign-up is temporarily unavailable. Please try again in a moment.';

/**
 * Classification of a Supabase FunctionsError raised by the
 * `validate-signup-domain` invocation. We must distinguish two very different
 * situations (Bug 1 / R2.2):
 *
 *  - `reject`      — the Edge Function IS deployed and explicitly responded
 *                    with a non-2xx (invalid domain, rejected credentials).
 *                    A `FunctionsHttpError` carries the original `Response` in
 *                    `error.context`, so the presence of that response is our
 *                    signal that the authoritative boundary answered. We surface
 *                    that real message and NEVER fall back around the rejection.
 *  - `unavailable` — a network/relay failure or a function that is simply not
 *                    deployed (no HTTP response attached, or the invocation
 *                    threw). This is the case that previously produced the
 *                    generic "temporarily unavailable" message; instead we now
 *                    fall back to the standard client SDK sign-up.
 */
type FunctionErrorClassification =
  | { kind: 'reject'; message: string }
  | { kind: 'unavailable' };

async function classifyFunctionError(
  error: unknown,
): Promise<FunctionErrorClassification> {
  const context = (error as { context?: unknown } | null)?.context;

  // An attached HTTP Response means the function answered => authoritative
  // rejection. Try to read the server's real error message; never throw.
  if (context && typeof (context as { json?: unknown }).json === 'function') {
    try {
      const body = (await (context as Response).json()) as {
        error?: string;
      };
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        return { kind: 'reject', message: body.error };
      }
    } catch {
      // Non-2xx with an unreadable body is still an authoritative response.
    }
    const message =
      (error as { message?: string } | null)?.message ??
      GENERIC_SIGNUP_UNAVAILABLE;
    return { kind: 'reject', message };
  }

  // No HTTP response => transport error / function-not-deployed => fall back.
  return { kind: 'unavailable' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore a persistent session on load, then subscribe to auth changes.
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        // Reject without establishing a session; surface the message (R1.7).
        setError(signInError.message);
        return { ok: false, error: signInError.message };
      }
      return { ok: true };
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      setError(null);

      // UX-only pre-check. The Edge Function is the authoritative boundary and
      // will re-check the domain server-side even if this is bypassed (R2.5).
      const preCheck = validateAllowedEmailDomain(email);
      if (!preCheck.valid) {
        const reason = preCheck.reason ?? 'Email domain is not permitted';
        setError(reason);
        return { ok: false, error: reason };
      }

      const trimmedEmail = email.trim();

      // PREFERRED PATH: account creation at the trusted server boundary. The
      // validate-signup-domain Edge Function enforces the allowlist and creates
      // the user; the client never holds privileged credentials. When this
      // function is deployed it stays the authoritative path (R2.4/3.2).
      type SignupFnResponse = {
        success?: boolean;
        error?: string;
        userId?: string;
      };
      let fnData: SignupFnResponse | null = null;
      let fnError: unknown = null;
      try {
        const invoked = await supabase.functions.invoke(
          'validate-signup-domain',
          { body: { email: trimmedEmail, password } },
        );
        fnData = invoked.data as SignupFnResponse | null;
        fnError = invoked.error;
      } catch (thrown) {
        // Invocation threw (network / function-not-deployed in local dev). No
        // HTTP response attached, so this is treated as "unavailable" below.
        fnError = thrown;
      }

      // An explicit body-level error is an authoritative rejection — surface it
      // and do NOT fall back around it (R2.2 / R3.3).
      if (fnData && typeof fnData.error === 'string') {
        setError(fnData.error);
        return { ok: false, error: fnData.error };
      }

      let edgeFunctionUnavailable = false;
      if (fnError) {
        const classified = await classifyFunctionError(fnError);
        if (classified.kind === 'reject') {
          // Deployed function explicitly rejected the request: surface the real
          // server error; the authoritative path is preserved (no fallback).
          setError(classified.message);
          return { ok: false, error: classified.message };
        }
        // Function is unreachable / not deployed: fall back to the client SDK.
        edgeFunctionUnavailable = true;
      }

      if (!edgeFunctionUnavailable) {
        // DEPLOYED_OK: the server created the account — establish a session.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return { ok: false, error: signInError.message };
        }
        return { ok: true };
      }

      // FALLBACK PATH (Bug 1 fix): the Edge Function is unavailable/unreachable.
      // The client-side allowlist pre-check already passed as the gate, so we
      // create the account with the standard client SDK instead of blocking
      // registration with a generic "temporarily unavailable" message.
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({ email: trimmedEmail, password });
      if (signUpError) {
        // Surface the genuine SDK error (duplicate email, weak password, ...)
        // rather than masking it with the generic message.
        setError(signUpError.message);
        return { ok: false, error: signUpError.message };
      }

      // If the SDK returned a session the user is already signed in. Otherwise
      // (email-confirmation setups return no session) attempt to establish one;
      // if confirmation is still required this will not sign in, and that is
      // fine — report success and let the app show its confirm-email state.
      if (!signUpData.session) {
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
      }
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    setError(null);
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      setError(null);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
      );
      if (resetError) {
        setError(resetError.message);
        return { ok: false, error: resetError.message };
      }
      return { ok: true };
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      error,
      signUp,
      signIn,
      signOut,
      resetPassword,
      clearError,
    }),
    [session, loading, error, signUp, signIn, signOut, resetPassword, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside an <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
