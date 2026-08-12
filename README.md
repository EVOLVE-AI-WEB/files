# Macro & Body Composition Calculator (Evolve Fitness)

An Android-mobile-first, installable Progressive Web App that calculates daily bulking/surplus macros, BMI, U.S. Navy body-fat %, fat mass, and lean body mass. It supports authenticated accounts, a persistent baseline profile, daily morning-weight logging, a 7-day rolling average, optional automatic weekly macro updates, goal progress, trend charts, optional reminders, and secure account/data deletion.

## Tech stack

- **Frontend:** React + Vite + TypeScript (strict mode), Tailwind CSS, Framer Motion
- **Backend / data:** Supabase (Auth + PostgreSQL)
- **UI:** Lucide (icons), Recharts (trend charts)
- **Testing:** Vitest, React Testing Library, fast-check (property-based testing)

## Disclaimer

> These calculations provide estimates for informational and personal planning purposes. BMI and circumference-based body-fat methods have limitations and are not medical diagnoses.

The `16.8 kcal/lb` value used for total daily calories is a **configurable default multiplier**, not a medically exact constant. Adjust it to suit individual coaching needs.

## The five-concept weight model (core invariant)

The application distinguishes five separate weight concepts. Keeping them separate is the central correctness invariant of the whole system.

- **A) Baseline weight** — `profiles.baseline_weight_kg`. The user's stable starting weight, set during onboarding. It is the default input to the macro formulas.
- **B) Daily progress logs** — `progress_entries.weight_kg`. Individual morning weigh-ins recorded over time. These are observations, not settings.
- **C) 7-day rolling average** — *derived* (never stored as a source of truth). Computed from qualifying daily progress logs to smooth out day-to-day noise.
- **D) Active macro weight** — `profiles.active_macro_weight_kg`. The **ONLY** weight that is ever fed into the macro formulas.
- **E) Goal weight** — `profiles.goal_weight_kg`. A **display target only**, used for goal-progress visualization.

### Non-negotiable rules

- Logging daily progress **never** modifies the baseline weight.
- **Auto OFF** ⇒ `active_macro_weight_kg` **=** baseline weight.
- **Auto ON** + a qualifying 7-day rolling average ⇒ `active_macro_weight_kg` **=** the rolling average.
- The baseline is **never** auto-overwritten by progress data.
- A single weigh-in **never** becomes the active macro weight on its own.
- The goal weight **never** feeds the macro formulas.
- Missing data is **never** fabricated or interpolated.
- Source selection (which weight becomes "active") happens **outside** the pure calculation functions — the calculators receive an already-resolved weight.

## Calculation reference

### Macros

```
weightLb     = weightKg × 2.20462
totalCalories = weightLb × 16.8
proteinGrams  = weightLb × 1.0
fatGrams      = weightLb × 0.4
proteinCalories = proteinGrams × 4
fatCalories     = fatGrams × 9
carbGrams     = (totalCalories − proteinCalories − fatCalories) / 4
```

Intermediate values are **never** rounded; only final display values are rounded at the presentation layer.

**Verified 70 kg reference vector:** `2,593 kcal / 154 g protein / 62 g fat / 355 g carbs`.

### Body composition

```
BMI      = weightKg / (heightCm / 100)²
```

- **U.S. Navy body-fat %:** uses circumference measurements in **inches** and `Math.log10` per the Navy formula.
- **Fat mass:** `fatMass  = weight × (bodyFatPercent / 100)`
- **Lean body mass:** `leanMass = weight − fatMass`

## Prerequisites

- **Node.js 20+** (developed on Node 22)
- A **Supabase project**
- The **Supabase CLI**

## Environment variables

Copy the example file and fill in your project's values:

```bash
cp .env.example .env
```

Set the following **public** values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> **Warning:** Never place the service-role key or the database password in client code, the built bundle, `localStorage`, or source control. Those secrets are used **only server-side** by the Supabase Edge Functions.

## Install & run

```bash
npm install       # install dependencies
npm run dev       # start the local dev server
npm run build     # tsc -b + vite build
npm run preview   # preview the production build locally
npm run test      # run the test suite in watch mode
npm run test:run  # run the test suite once (single run)
```

## Supabase setup

1. **Apply schema + RLS** from `supabase/migrations/`:

   ```bash
   supabase db push
   ```

   This creates the tables `profiles`, `macro_settings`, `progress_entries`, `macro_target_history`, and `reminder_preferences` with:
   - `CHECK` constraints on value ranges,
   - `UNIQUE(user_id, logged_date)` to prevent duplicate daily entries,
   - cascading foreign keys, and
   - Row Level Security scoped to `auth.uid() = user_id` on **every** table. `macro_target_history` is **append-only** (insert/select only — no update policy).

2. **Deploy Edge Functions** from `supabase/functions/`:

   ```bash
   supabase functions deploy validate-signup-domain
   supabase functions deploy delete-account-and-data
   ```

   - **`validate-signup-domain`** — authoritatively enforces the email allowlist (`gmail.com`, `yahoo.com`, `outlook.com`, `hotmail.com`, `icloud.com`). Matching is an exact, case-insensitive comparison of the domain after the final `@`; look-alike domains are rejected. Any client-side pre-check is UX-only and non-authoritative.
   - **`delete-account-and-data`** — deletes the auth user using the service-role key **server-side only**; all associated rows are removed via cascading foreign keys. Success is reported **only after** deletion is verified.

   Both functions read `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from their **server-side** environment.

## Progressive Web App

- `public/manifest.webmanifest` (`standalone` display mode, theme/background colors) is linked from `index.html`.
- `public/sw.js` uses a cache-first strategy for the app shell and network for Supabase data (best-effort offline support — **not** a full offline-sync guarantee).
- Optional **Body Composition Check-In** reminders are **OFF by default**, require explicit opt-in plus notification permission, and honestly acknowledge that browsers/PWAs cannot guarantee background scheduled notifications (there is no hidden backend scheduler).

## Project structure

- `src/calculations` — pure math functions + their tests.
- `src/validation` — input validators.
- `src/state` — active-weight selector, derived macro state, macro-target-history helpers.
- `src/data` — React Query hooks + `snake_case` ↔ `camelCase` mappers.
- `src/auth` — authentication.
- `src/routing` — app routing.
- `src/features` — feature modules: `auth`, `onboarding`, `calculator`, `dashboard`, `progress`, `profile`, `shell`, `shared`.
- `src/__integration__` — deterministic RLS + deletion contract tests.
- `supabase/migrations` — SQL schema, constraints, and RLS policies.
- `supabase/functions` — Edge Functions.

## Testing

- **Unit tests** for every pure calculation/validation function (including the 70 kg reference vector).
- **Property-based tests** (fast-check, ≥100 iterations) for the design's correctness properties:
  - macro determinism,
  - carbs = remaining calories,
  - no rounding of intermediates,
  - unit round-trips,
  - Navy formula using inches + `log10`,
  - rolling-average missing-day honesty,
  - baseline invariance,
  - auto-update qualification,
  - goal never feeding macros,
  - goal-progress edge cases,
  - fat/lean derivation honesty,
  - email allowlist enforcement.
- **Deterministic integration tests** for RLS isolation (parsed from the migration SQL) and the trusted-boundary deletion + allowlist behavior.

Run the full suite once:

```bash
npm run test:run
```

## Accessibility & mobile

- Responsive from ~320px wide with no horizontal overflow.
- Safe-area insets respected.
- 44–48px touch targets.
- `inputMode` set to `decimal`/`numeric` where appropriate.
- Full keyboard navigation and ARIA labeling.
- Accessible color contrast; status is never conveyed by color alone.
- Light/dark theme with a persisted user preference.
