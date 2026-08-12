import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Single, shared Supabase client for the whole application.
 *
 * SECURITY: only the public anon key is ever read here. The service-role key
 * and the database password MUST NEVER be present in the client bundle
 * (Requirement 18.6). Trust-sensitive operations (email-domain allowlist
 * enforcement, account + data deletion) run on the server boundary via Edge
 * Functions, never with client-held privileged credentials.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Define VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in your environment (see .env.example).',
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
