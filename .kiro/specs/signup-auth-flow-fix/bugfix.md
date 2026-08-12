# Bugfix Requirements Document

## Introduction

The Macro & Body Composition Calculator currently blocks account registration
in any environment where the trusted Supabase server boundary is not fully
provisioned (local development, mock/placeholder credentials, or a
not-yet-deployed Edge Function). Three related defects combine to make sign-up
completely unusable in these environments:

- **Bug 1 — Sign-up is unconditionally blocked.** `signUp()` in
  `src/auth/AuthProvider.tsx` creates accounts *exclusively* by invoking the
  `validate-signup-domain` Supabase Edge Function. When that function is absent
  or unreachable, the invocation errors and the code falls back to the constant
  `GENERIC_SIGNUP_UNAVAILABLE` ("Sign-up is temporarily unavailable. Please try
  again in a moment."). Users can never register when the function is not
  deployed, and genuine Supabase errors (duplicate email, weak password) are
  masked by the same generic message.

- **Bug 2 — Fragile disclaimer imports.** `src/features/shared/Disclaimer.tsx`
  imports `DISCLAIMER_TEXT` and `CALORIE_MULTIPLIER_NOTE` from the lowercase
  companion `./disclaimer` (`src/features/shared/disclaimer.ts`). That file
  differs from the component only by filename case, which risks collisions on
  case-insensitive filesystems, and the report indicates the lowercase file was
  removed in some environments — breaking the import and every consumer of
  those constants (`Disclaimer.tsx` and `CalculatorScreen.tsx`).

- **Bug 3 — Hard crash on missing/mock credentials.** `src/lib/supabase.ts`
  throws `new Error('Missing Supabase configuration...')` at module load when
  `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing. Because this runs
  at import time, the *entire* app crashes before rendering whenever env vars
  are absent or set to placeholder values — compounding Bug 1 by preventing the
  app from loading at all.

The fix must restore the ability to register while preserving the security and
allowlist guarantees defined in the parent spec (R1 auth, R2 server-enforced
email allowlist, R18.6 secrets, R24 disclaimer surfacing). The bug condition
methodology below defines exactly which inputs trigger each defect (the fix
must correct those) versus which inputs must behave identically before and
after the fix (regression prevention).

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — Sign-up blocked when the Edge Function is unavailable (R1, R2)**

1.1 WHEN a user submits sign-up with an allowed email domain and a valid
password AND the `validate-signup-domain` Edge Function is not deployed or is
unreachable THEN the system aborts registration and displays "Sign-up is
temporarily unavailable. Please try again in a moment.", so no account is ever
created.

1.2 WHEN `supabase.functions.invoke('validate-signup-domain', ...)` returns a
genuine error from Supabase auth (e.g., duplicate account, weak password) THEN
the system collapses it into the generic `GENERIC_SIGNUP_UNAVAILABLE` message,
masking the real, actionable cause from the user.

**Bug 2 — Broken/fragile disclaimer imports (R24)**

1.3 WHEN the lowercase `src/features/shared/disclaimer.ts` is absent (removed in
some environments) OR the build runs on a case-insensitive filesystem where
`Disclaimer.tsx` and `disclaimer.ts` collide THEN the import of
`DISCLAIMER_TEXT` and `CALORIE_MULTIPLIER_NOTE` fails to resolve, breaking
`Disclaimer.tsx` and `CalculatorScreen.tsx` and the build/render that depends on
them.

**Bug 3 — Supabase client crashes on missing/mock credentials (R18.6)**

1.4 WHEN `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, empty, or a
mock/placeholder value THEN `src/lib/supabase.ts` throws at module load, which
hard-crashes the whole application at import time and prevents any screen
(including sign-up) from rendering.

### Expected Behavior (Correct)

**Bug 1 — Resilient sign-up with authoritative-path preservation (R1, R2)**

2.1 WHEN a user submits sign-up with an allowed email domain and a valid
password AND the `validate-signup-domain` Edge Function is unavailable or
unreachable THEN the system SHALL fall back to the standard client SDK sign-up
(`supabase.auth.signUp`) so registration succeeds, after the client-side
allowlist pre-check (`validateAllowedEmailDomain`) has passed as a gate.

2.2 WHEN the Edge Function returns a genuine error THEN the system SHALL
distinguish "function not available/unreachable" (→ fall back to the client SDK
sign-up) from "function explicitly rejected the request" (invalid domain,
rejected credentials → surface that real error and do NOT fall back around the
rejection); and WHEN the client SDK sign-up itself returns a genuine error
(duplicate account, weak password) THEN the system SHALL surface that specific
error rather than the generic "temporarily unavailable" message.

**Bug 2 — Stable disclaimer constants (R24)**

2.3 WHEN `Disclaimer.tsx` or `CalculatorScreen.tsx` needs `DISCLAIMER_TEXT` and
`CALORIE_MULTIPLIER_NOTE` THEN the system SHALL resolve those exports reliably
from a source that does not collide by filename case with `Disclaimer.tsx`
(either defined directly inside `Disclaimer.tsx` or in a distinctly-named
constants module such as `disclaimerContent.ts`), keeping the disclaimer text
verbatim per R24 and keeping `CALORIE_MULTIPLIER_NOTE` derived from
`CONFIG.DEFAULT_CALORIE_MULTIPLIER` so the copy never drifts from the value.

**Bug 3 — Graceful Supabase client initialization (R18.6)**

2.4 WHEN `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or clearly
mock/placeholder THEN `src/lib/supabase.ts` SHALL NOT throw at module load;
instead it SHALL initialize with safe fallback values (or a clearly-flagged
degraded/mock client), emit a non-fatal developer-friendly warning, and allow
the app to render and registration to proceed via the Bug 1 fallback path —
while never reading anything beyond the public anon key/URL client-side.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN any email is checked for sign-up THEN the system SHALL CONTINUE TO
enforce the exact email-domain allowlist (`gmail.com`, `yahoo.com`,
`outlook.com`, `hotmail.com`, `icloud.com`; case-insensitive exact match on the
substring after the final `@`; look-alikes/supersets rejected) client-side, and
server-side when the Edge Function is deployed (P14, R2.1–2.6).

3.2 WHEN the `validate-signup-domain` Edge Function IS deployed and reachable
THEN the system SHALL CONTINUE TO treat it as the authoritative account-creation
path and SHALL NOT bypass it with the fallback (R2.4).

3.3 WHEN the Edge Function IS deployed and explicitly rejects a request (invalid
domain, rejected credentials) THEN the system SHALL CONTINUE TO surface that
real server error to the user rather than silently falling back.

3.4 WHEN the client bundle is built THEN it SHALL CONTINUE TO contain only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and SHALL NEVER contain the
service-role key or database password (R18.6).

3.5 WHEN any pure calculation or validation runs (five-concept weight-model
invariants, Navy body-fat, macro derivation, macro-settings/progress/goal
validators) THEN the system SHALL CONTINUE TO behave exactly as before — these
paths are unrelated to the fix and must remain untouched.

3.6 WHEN a user requests account deletion THEN the system SHALL CONTINUE TO run
the `delete-account-and-data` trusted-boundary flow unchanged (R17).

3.7 WHEN the disclaimer is rendered THEN the system SHALL CONTINUE TO display the
exact verbatim `DISCLAIMER_TEXT` from design.md (R24) and a
`CALORIE_MULTIPLIER_NOTE` that reflects `CONFIG.DEFAULT_CALORIE_MULTIPLIER`, and
all existing importers SHALL CONTINUE TO work.

3.8 WHEN valid Supabase credentials ARE provided THEN `src/lib/supabase.ts` SHALL
CONTINUE TO create the real client with the same auth options
(`persistSession`, `autoRefreshToken`, `detectSessionInUrl`) and unchanged
runtime behavior.

3.9 WHEN the existing test suite runs THEN the system SHALL CONTINUE TO pass all
183 currently-passing tests.

## Bug Condition & Property Specification

The bug condition `C(X)` identifies the inputs that trigger each defect; the fix
`F'` must satisfy the fix-checking property for those inputs, and must satisfy
the preservation property `F(X) = F'(X)` for every non-buggy input `¬C(X)`.

### Bug 1 — Sign-up availability

```pascal
FUNCTION isBugCondition_signUp(X)
  INPUT: X = { email, password, edgeFnState }
         edgeFnState in { UNAVAILABLE, DEPLOYED_OK, DEPLOYED_REJECTS }
  OUTPUT: boolean

  // Bug triggers only when the client pre-check would pass AND the
  // authoritative boundary is simply not there to complete creation.
  RETURN validateAllowedEmailDomain(X.email).valid
     AND isValidPassword(X.password)
     AND X.edgeFnState = UNAVAILABLE
END FUNCTION
```

```pascal
// Property: Fix Checking — resilient sign-up
FOR ALL X WHERE isBugCondition_signUp(X) DO
  result ← signUp'(X)          // F' uses supabase.auth.signUp fallback
  ASSERT result.ok = true      // account created, no generic-unavailable error
  ASSERT result.error IS NULL
END FOR

// Property: Preservation — authoritative path & genuine rejections unchanged
FOR ALL X WHERE NOT isBugCondition_signUp(X) DO
  ASSERT signUp(X) = signUp'(X)
  // includes: disallowed domain -> domain error;
  //           edgeFnState = DEPLOYED_OK -> Edge Function creates account;
  //           edgeFnState = DEPLOYED_REJECTS -> real server error surfaced;
  //           SDK duplicate/weak-password -> that specific error surfaced
END FOR
```

### Bug 2 — Disclaimer constant resolution

```pascal
FUNCTION isBugCondition_disclaimer(X)
  INPUT: X = { lowercaseFilePresent, caseInsensitiveFS }
  OUTPUT: boolean

  RETURN (NOT X.lowercaseFilePresent) OR X.caseInsensitiveFS
END FUNCTION
```

```pascal
// Property: Fix Checking — exports always resolve
FOR ALL X WHERE isBugCondition_disclaimer(X) DO
  ASSERT resolves(DISCLAIMER_TEXT) AND resolves(CALORIE_MULTIPLIER_NOTE)
  ASSERT DISCLAIMER_TEXT = VERBATIM_DESIGN_TEXT           // R24
  ASSERT CALORIE_MULTIPLIER_NOTE contains CONFIG.DEFAULT_CALORIE_MULTIPLIER
END FOR
```

### Bug 3 — Supabase client initialization

```pascal
FUNCTION isBugCondition_supabaseInit(X)
  INPUT: X = { url, anonKey }
  OUTPUT: boolean

  RETURN isMissingOrMock(X.url) OR isMissingOrMock(X.anonKey)
END FUNCTION
```

```pascal
// Property: Fix Checking — no throw at module load
FOR ALL X WHERE isBugCondition_supabaseInit(X) DO
  ASSERT loadModule('src/lib/supabase.ts') does NOT throw
  ASSERT client is defined (safe-fallback / flagged-degraded)
  ASSERT developerWarningEmitted = true
  ASSERT clientReads ⊆ { url, anonKey }   // never service-role/DB password (R18.6)
END FOR

// Property: Preservation — real client unchanged for valid credentials
FOR ALL X WHERE NOT isBugCondition_supabaseInit(X) DO
  ASSERT createClient(X.url, X.anonKey, sameAuthOptions) unchanged
END FOR
```

## Fix Verification / Regression Tests

**Fix checking (must newly pass after the fix):**

- Sign-up succeeds via the client SDK fallback when the Edge Function is
  unavailable/unreachable, given an allowed email domain and a valid password
  (covers 2.1).
- A genuine Supabase sign-up error (duplicate email, weak password) surfaced by
  the SDK fallback is reported to the user rather than masked by the generic
  "temporarily unavailable" message (covers 2.2).
- When the Edge Function IS deployed and explicitly rejects the request, its real
  error is surfaced and no fallback occurs (covers 2.2 / 3.3, authoritative path
  preserved).
- `DISCLAIMER_TEXT` and `CALORIE_MULTIPLIER_NOTE` import/resolve with no missing
  exports; `DISCLAIMER_TEXT` is verbatim per design.md and
  `CALORIE_MULTIPLIER_NOTE` reflects `CONFIG.DEFAULT_CALORIE_MULTIPLIER` (covers
  2.3).
- Importing `src/lib/supabase.ts` does not throw when env vars are missing or
  mock; the module exposes a usable/degraded client and emits a developer
  warning (covers 2.4).

**Preservation checking (must continue to pass):**

- Sign-up still fails with a clear domain error for a disallowed or look-alike
  domain — the allowlist is not weakened (covers 3.1, P14).
- The `validate-signup-domain` Edge Function remains the authoritative path when
  deployed (covers 3.2).
- The client bundle still contains only the public URL + anon key; no
  service-role key or DB password is introduced (covers 3.4, R18.6).
- With valid credentials provided, `src/lib/supabase.ts` creates the real client
  with unchanged auth options and behavior (covers 3.8).
- `delete-account-and-data` trusted-boundary behavior is unchanged (covers 3.6,
  R17).
- All 183 currently-passing tests continue to pass, including the pure
  calculation/validation and weight-model invariant suites (covers 3.5, 3.9).
