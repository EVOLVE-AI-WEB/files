// =============================================================================
// Supabase Edge Function: validate-signup-domain
// Feature:  Macro & Body Composition Calculator (Evolve Fitness)
// Task:      8.1 — Authoritative, server-side email-domain allowlist enforcement
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.6
//
// This is the AUTHORITATIVE trusted boundary for the sign-up email-domain
// allowlist. The client also runs validateAllowedEmailDomain() for UX, but that
// check can be bypassed; this function is the source of truth (R2.4). It creates
// the account only when the domain is allowed, and rejects with NO account
// created otherwise (R2.3).
//
// Deno runtime note: Edge Functions run in a separate Deno runtime and cannot
// import the app's src/config.ts. The allowlist below is intentionally
// duplicated to mirror the shared rule in src/config.ts (CONFIG.ALLOWED_EMAIL_
// DOMAINS) and src/validation/validators.ts (validateAllowedEmailDomain). Keep
// the two lists in sync if either changes.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Mirrors CONFIG.ALLOWED_EMAIL_DOMAINS in src/config.ts (shared rule, separate
// runtime — duplicated intentionally).
const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
] as const;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Authoritative allowlist check. Mirrors the client rule exactly:
 *   - exactly one parseable '@' structure (R2.6),
 *   - domain parsed as the substring AFTER the FINAL '@',
 *   - lowercased before comparison (R2.2),
 *   - exact match against the allowlist — no substring/superset acceptance,
 *     so gmail.co / fakegmail.com / gmail.com.example.com are rejected (R2.3).
 */
function validateAllowedEmailDomain(
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

  if (!(ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain)) {
    return {
      valid: false,
      reason: `Email domain "${domain}" is not permitted`,
    };
  }

  return { valid: true };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let payload: { email?: unknown; password?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { email, password } = payload;

  // Authoritative domain gate — reject BEFORE any account is created (R2.3).
  const domainCheck = validateAllowedEmailDomain(email);
  if (!domainCheck.valid) {
    return json({ error: domainCheck.reason ?? 'Email domain not allowed' }, 400);
  }

  if (typeof password !== 'string' || password.length === 0) {
    return json({ error: 'Password is required' }, 400);
  }

  // Server-only secrets: read from the function's own environment. These are
  // NEVER shipped in the client bundle. The service-role key must stay
  // server-side only.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server is not configured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Domain is allowed — create the account at the trusted boundary.
  const { data, error } = await admin.auth.admin.createUser({
    email: (email as string).trim().toLowerCase(),
    password,
    email_confirm: false,
  });

  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ success: true, userId: data.user?.id ?? null }, 200);
});
