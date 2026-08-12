import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Single, shared Supabase client for the whole application.
 *
 * SECURITY: only the public anon key and URL are ever read here. The
 * service-role key and the database password MUST NEVER be present in the
 * client bundle (Requirement 18.6). Trust-sensitive operations (email-domain
 * allowlist enforcement, account + data deletion) run on the server boundary
 * via Edge Functions, never with client-held privileged credentials.
 *
 * RESILIENCE (Bug 3 fix): this module must NEVER throw at import time. Throwing
 * here previously hard-crashed the entire app before it could render whenever
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` were missing or set to
 * placeholder values. Instead, when real credentials are absent we fall back to
 * syntactically-valid placeholder values so `createClient` succeeds and the app
 * renders in a clearly-flagged degraded mode. Auth/data calls will fail until
 * real values are provided, but the UI (including sign-up) still loads.
 */

/** Placeholder used only when real credentials are missing/mock. */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_ANON_KEY = 'public-anon-key-placeholder';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * A value counts as usable only when it is a non-empty string that is not an
 * obvious placeholder/mock. This keeps the "missing", "empty", and
 * "clearly-placeholder" cases all on the safe degraded path.
 */
function isUsable(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  const lowered = trimmed.toLowerCase();
  return !(
    lowered.includes('placeholder') ||
    lowered.includes('your-') ||
    lowered.includes('changeme') ||
    lowered === 'mock' ||
    lowered === 'undefined' ||
    lowered === 'null'
  );
}

/** True when both real public credentials were provided (see exports below). */
export const isSupabaseConfigured: boolean =
  isUsable(rawUrl) && isUsable(rawAnonKey);

const supabaseUrl = isSupabaseConfigured ? (rawUrl as string) : PLACEHOLDER_URL;
const supabaseAnonKey = isSupabaseConfigured
  ? (rawAnonKey as string)
  : PLACEHOLDER_ANON_KEY;

if (!isSupabaseConfigured) {
  // Single, non-fatal developer-friendly warning. Not an error — the app still
  // renders; auth/data calls simply fail until real VITE_SUPABASE_* are set.
  console.warn(
    '[supabase] Running in degraded/unconfigured mode: VITE_SUPABASE_URL and/or ' +
      'VITE_SUPABASE_ANON_KEY are missing or placeholder values. The app will ' +
      'render, but authentication and data calls will fail until real ' +
      'credentials are provided (see .env.example).',
  );
}

// Same auth options in both modes so real-credential behavior is unchanged.
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
