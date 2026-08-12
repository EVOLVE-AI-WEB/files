// =============================================================================
// Supabase Edge Function: delete-account-and-data
// Feature:  Macro & Body Composition Calculator (Evolve Fitness)
// Task:      8.2 — Trusted-boundary account & data deletion
// Requirements: 17.2, 17.3, 17.5
//
// Permanently deletes the caller's auth user using the service-role key
// SERVER-SIDE ONLY. Deleting the auth.users row cascades all associated data
// via the `on delete cascade` foreign keys defined in the schema migration
// (R17.3). Clients can NEVER delete the auth user directly — only this trusted
// boundary can (R17.2, Correctness_Property P16).
//
// Success is confirmed by re-reading the user after deletion. Only a VERIFIED
// deletion returns success; any failure returns a retryable error and never
// reports premature success (R17.5). The client performs sign-out / cache clear
// ONLY after this function confirms success.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  // The caller must present their own access token. We resolve the user id from
  // the token itself (never trust a user id supplied in the body) so a client
  // can only ever delete THEIR OWN account.
  const authHeader = req.headers.get('Authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (accessToken.length === 0) {
    return json({ error: 'Missing authorization token' }, 401);
  }

  // Server-only secrets: read from the function's own environment. The
  // service-role key is NEVER present in the client bundle, localStorage, or
  // source control — it must stay server-side only.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server is not configured' }, 500);
  }

  // 1) Resolve the authenticated caller from their token (anon client + JWT).
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) {
    // Retryable: caller must be authenticated; state unchanged.
    return json({ error: 'Could not verify the requesting user' }, 401);
  }
  const userId = userData.user.id;

  // 2) Delete the auth user with the service-role admin client (server-only).
  //    Cascade FKs remove all associated rows across every table (R17.3).
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    // Never report premature success — surface a retryable error (R17.5).
    return json(
      { error: 'Deletion failed; please retry.', detail: deleteErr.message },
      502,
    );
  }

  // 3) VERIFY the deletion before responding. If the user still resolves, the
  //    operation did not truly succeed — return a retryable error (R17.5).
  const { data: verify, error: verifyErr } =
    await admin.auth.admin.getUserById(userId);

  if (!verifyErr && verify?.user) {
    return json(
      { error: 'Deletion could not be verified; please retry.' },
      502,
    );
  }

  // Verified success: the auth user (and, via cascade, all their data) is gone.
  return json({ success: true }, 200);
});
