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
 * Best-effort extraction of a human-readable message from a Supabase
 * FunctionsError. Non-2xx responses carry the original `Response` in
 * `error.context`; reading it can fail (or not exist in dev), so this never
 * throws and falls back to a friendly generic message.
 */
async function friendlyFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (
    context &&
    typeof (context as { json?: unknown }).json === 'function'
  ) {
    try {
      const body = (await (context as Response).json()) as {
        error?: string;
      };
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        return body.error;
      }
    } catch {
      // fall through to generic message
    }
  }
  return GENERIC_SIGNUP_UNAVAILABLE;
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

      // Account creation happens at the trusted server boundary. The
      // validate-signup-domain Edge Function enforces the allowlist and creates
      // the user; the client never holds privileged credentials.
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
          { body: { email: email.trim(), password } },
        );
        fnData = invoked.data as SignupFnResponse | null;
        fnError = invoked.error;
      } catch (thrown) {
        // Network / function-not-deployed (local dev): fail friendly, no crash.
        fnError = thrown;
      }

      if (fnError) {
        const message = await friendlyFunctionError(fnError);
        setError(message);
        return { ok: false, error: message };
      }

      if (fnData && typeof fnData.error === 'string') {
        setError(fnData.error);
        return { ok: false, error: fnData.error };
      }

      // Server created the account — now establish a session for the user.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return { ok: false, error: signInError.message };
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
