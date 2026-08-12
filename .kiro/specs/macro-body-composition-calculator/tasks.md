# Implementation Plan: Macro & Body Composition Calculator (Evolve Fitness)

## Overview

This plan converts the approved design into a series of incremental, dependency-ordered coding tasks for a React + Vite + TypeScript PWA backed by Supabase. It is deliberately **test-driven at the core**: the pure calculation and validation layer is built and verified first (unit + property-based tests for P1–P14, anchored by the verified 70 kg → 2,593 kcal / 154 g / 62 g / 355 g reference vector), then the Supabase server boundary (schema, RLS, CHECK constraints, `UNIQUE(user_id, logged_date)`, and the two trusted Edge Functions), then the state layer that enforces the five-concept separation and performs active-weight selection **outside** the calculation layer, then the auth/onboarding/feature screens, then the design system / PWA / accessibility polish, and finally the RLS (P15) and trusted-deletion (P16) integration tests plus a green production build.

Every task references the requirement clauses (R1–R26) and, where relevant, the correctness properties (P1–P16) it implements. Sub-tasks marked with `*` are optional tests that can be skipped for a faster MVP; all other sub-tasks are required implementation.

The implementation language is **TypeScript** (strict), matching the design.

## Tasks

- [x] 1. Project setup, tooling, and shared foundations
  - [x] 1.1 Initialize the project and install dependencies
    - Scaffold a React + Vite + TypeScript (strict mode) project
    - Install runtime deps: `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `framer-motion`, `lucide-react`, `recharts`, `tailwindcss` (+ `postcss`, `autoprefixer`)
    - Install dev/test deps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `fast-check`
    - Configure Tailwind (content globs, `darkMode: 'class'`), Vitest (jsdom env, setup file), and TypeScript strict settings
    - Add npm scripts: `dev`, `build`, `preview`, `test`, `test:run`
    - _Requirements: 26.5_

  - [x] 1.2 Configure the typed Supabase client and environment template
    - Create a single Supabase client module reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only; never the service-role key or DB password)
    - Create `.env.example` containing only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` placeholders
    - _Requirements: 18.6_

  - [x] 1.3 Define core domain types and centralized CONFIG
    - Add `Unit`, `Sex`, `BodyFatMethod`, `MacroSettings`, `MacroResult`, `ProgressEntry`, `RollingAverageResult`, `AutoUpdateQualification`, `GoalProgress`, and category types
    - Add the `CONFIG` object (multiplier defaults 16.8/1.0/0.4, `LB_PER_KG`, `CM_PER_INCH`, `ROLLING_WINDOW_DAYS = 7`, `AUTO_UPDATE_MIN_MEASUREMENTS = 4`, `ALLOWED_EMAIL_DOMAINS`, `MACRO_SETTINGS_BOUNDS`)
    - _Requirements: 4.1, 5.2, 5.3, 5.4, 6.1, 11.1, 12.4_

- [x] 2. Pure calculation layer — unit conversion and macros (test-driven)
  - [x] 2.1 Implement unit-conversion helpers
    - Implement `kgToLb`, `lbToKg`, `cmToInches`, `inchesToCm` as pure, unrounded functions
    - _Requirements: 5.1, 8.1_

  - [x]* 2.2 Write property test for unit-conversion round-trips
    - **Property 4: Unit conversion round-trips preserve canonical value**
    - **Validates: Requirements 5.1, 8.1**
    - Tag: `Feature: macro-body-composition-calculator, Property 4: ...`

  - [x] 2.3 Implement `calculateMacros` and macro helpers
    - Implement `calculateCalories`, `calculateProtein`, `calculateFat`, `calculateCarbs`, and `calculateMacros(activeCalculationWeightKg, settings)`
    - Compute carbs from remaining calories only; set `isCarbShortfall` + `carbGrams = 0` (never negative) + `guidanceMessage` when protein+fat calories exceed total; never round intermediates
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 6.4_

  - [x]* 2.4 Write unit test for the verified 70 kg reference vector
    - Assert `weightLb = 154.3234`, `totalCalories = 2592.63312`, `proteinGrams = 154.3234`, `fatGrams = 61.72936`, `carbGrams = 354.94382`, and displayed 2,593 / 154 / 62 / 355
    - _Requirements: 5.7, 26.1_

  - [x]* 2.5 Write property test for macro determinism regardless of weight source
    - **Property 1: Macro formula determinism regardless of weight source**
    - **Validates: Requirements 5.8, 4.2**

  - [x]* 2.6 Write property test for carbs = remaining calories, never negative
    - **Property 2: Carbs equal remaining calories; never negative**
    - **Validates: Requirements 5.5, 5.9, 6.4**

  - [x]* 2.7 Write property test for unrounded intermediates
    - **Property 3: Intermediate values never rounded**
    - **Validates: Requirements 5.6, 19.1**

- [x] 3. Pure calculation layer — BMI, Navy body fat, body composition (test-driven)
  - [x] 3.1 Implement BMI calculation and categorization
    - Implement `calculateBMI(weightKg, heightCm)` and `getBMICategory(bmi, age)` with the adult screening bands and the under-20 BMI-for-age percentile note
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x]* 3.2 Write unit tests for BMI bands and the under-20 branch
    - Cover each adult category boundary and the age < 20 percentile-note path
    - _Requirements: 7.2, 7.3_

  - [x] 3.3 Implement U.S. Navy body-fat calculations
    - Implement `calculateMaleNavyBodyFat` / `calculateFemaleNavyBodyFat` operating on inches (`cm / 2.54`) using `Math.log10` with the exact male/female coefficients
    - _Requirements: 8.1, 8.2, 8.3_

  - [x]* 3.4 Write property + fixture tests for Navy formulas
    - **Property 5: Navy formulas always receive inches and use log10**
    - **Validates: Requirements 8.1, 8.2, 8.3, 26.1**

  - [x] 3.5 Implement body-composition derivations and categories
    - Implement `calculateFatMass`, `calculateLeanBodyMass`, and `getBodyFatCategory(sex, bodyFat, age)` with the ACE-style, sex-dependent bands; return absent fat/lean mass when body fat is missing (never fabricated)
    - _Requirements: 9.1, 9.2, 9.3_

  - [x]* 3.6 Write property test for fat/lean mass derivation and missing-data honesty
    - **Property 13: Fat/lean mass derived correctly & not fabricated when BF% missing**
    - **Validates: Requirements 9.1, 9.2**

- [x] 4. Pure calculation layer — rolling average, auto-update, goal progress (test-driven)
  - [x] 4.1 Implement the 7-day rolling weight average
    - Implement `calculateRollingWeightAverage(entries, endDate, windowDays)`; include only valid entries in the inclusive window, ignore missing days (never zero-fill), report `measurementCount`, return `averageKg = null` when empty, full precision
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x]* 4.2 Write property test for the rolling average ignoring missing days
    - **Property 6: 7-day average ignores missing days and reports measurement count**
    - **Validates: Requirements 11.2, 11.3, 11.5**

  - [x] 4.3 Implement auto-macro-update qualification
    - Implement `isAutoMacroUpdateQualified(entries, period, minimumMeasurements)`; qualify only with a rolling average of `>= 4` measurements and once-per-period guard; never fabricate, never use a single outlier, never overwrite baseline
    - _Requirements: 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x]* 4.4 Write property test for qualifying-average-only auto updates
    - **Property 10: Auto Macro ON only uses qualifying averages (>= min, <= once/week)**
    - **Validates: Requirements 12.3, 12.4, 12.6**

  - [x] 4.5 Implement goal-progress calculation
    - Implement `calculateGoalProgress(starting, current, goal)`; guard divide-by-zero (`progressPercent = null` when `starting == goal`), classify `gaining|losing|reached|exceeded|undefined`, clamp `displayPercent` to [0,100]
    - _Requirements: 14.2, 14.3, 14.4, 14.5_

  - [x]* 4.6 Write property test for goal-progress cases and divide-by-zero guard
    - **Property 12: Goal progress handles gain/loss/reached/exceeded & divide-by-zero**
    - **Validates: Requirements 14.3, 14.4, 14.5**

- [x] 5. Validation layer (test-driven)
  - [x] 5.1 Implement centralized validators
    - Implement `validateAllowedEmailDomain` (exact, case-insensitive, domain after final `@`; reject look-alikes and non-single-`@` strings), `validateMacroSettings` (bounds calorie ≤ 40, protein ≤ 3, fat ≤ 2, all positive), `validateNavyMeasurements` (pre-`log10` positivity + `waist−neck > 0` / `waist+hip−neck > 0`, no NaN/∞, non-blocking warnings), `validateProgressEntry` (required positive weight, body fat 0–75), `validateGoalWeight`
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 6.3, 8.4, 8.6, 10.7, 14.1_

  - [x]* 5.2 Write property test for the email allowlist exact-match rule
    - **Property 14: Email allowlist exact-match rejects look-alikes**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.6**

  - [x]* 5.3 Write unit tests for macro-settings, Navy, progress-entry, and goal validators
    - Cover bounds rejection, pre-`log10` guards, warning-but-valid path, body-fat range, and goal validation
    - _Requirements: 6.3, 8.4, 8.5, 10.7, 14.1_

- [ ] 6. Checkpoint — calculation & validation core verified
  - Ensure all unit and property-based tests for the pure layer pass, ask the user if questions arise.

- [ ] 7. Supabase schema, constraints, and Row-Level Security
  - [ ] 7.1 Author SQL migrations for all tables
    - Create `profiles`, `macro_settings`, `progress_entries`, `macro_target_history`, and `reminder_preferences` with canonical units and the illustrative DDL from the design
    - Add CHECK constraints (age 1–129, positive height/weight, body fat 0–75, multiplier bounds, `macro_target_history.source` enum) and `UNIQUE(user_id, logged_date)`; `on delete cascade` FKs to `auth.users`
    - _Requirements: 10.2, 10.3, 18.4, 18.5, 13.2_

  - [ ] 7.2 Author RLS policies for every table
    - Enable RLS on all tables; add select/insert/update/delete policies restricted to `auth.uid() = user_id`; grant no update policy on `macro_target_history` (append-only)
    - _Requirements: 18.1, 18.2, 18.3, 13.1, 13.5_

- [ ] 8. Trusted server-boundary Edge Functions
  - [ ] 8.1 Implement `validate-signup-domain` Edge Function
    - Enforce the email-domain allowlist authoritatively server-side (parse after final `@`, lowercase, exact match); reject with no account created on failure; reuse the shared allowlist rule
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [ ] 8.2 Implement `delete-account-and-data` Edge Function
    - Use the service-role key server-side only to delete the auth user so data cascades; verify success before responding; return a retryable error on failure and never report premature success
    - _Requirements: 17.2, 17.3, 17.5_

- [ ] 9. Data-access layer (React Query over the typed client)
  - [ ] 9.1 Implement query/mutation hooks for profiles, macro settings, progress entries, and macro history
    - CRUD scoped by `auth.uid()`; progress upsert against `UNIQUE(user_id, logged_date)` with duplicate-edit handling and rapid-submit guard; append-only writes to `macro_target_history`; cache invalidation on mutation
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 13.1, 13.3, 13.4_

- [ ] 10. State layer — five-concept separation and Active_Weight_Selector
  - [ ] 10.1 Implement the Active_Weight_Selector and macro/derived state
    - In the state layer (outside the calc layer), select Active_Macro_Weight = Baseline when Auto OFF, = qualifying Rolling_Average when Auto ON + qualifying, else retain previous with a status message; expose baseline, active weight, latest 7-day average, effective date, and status; forbid goal weight or a single weigh-in from becoming active/baseline
    - Wire `calculateRollingWeightAverage` and `isAutoMacroUpdateQualified` as derived selectors; recompute rolling average on progress writes without mutating baseline
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 11.6, 12.5, 12.6_

  - [ ]* 10.2 Write property tests for weight-source separation invariants
    - **Property 7: A single daily weigh-in never changes baseline or macros**
    - **Property 8: Progress insert/update/delete never modifies baseline**
    - **Property 9: Auto Macro OFF preserves baseline macro behavior**
    - **Property 11: Goal weight never becomes macro weight**
    - **Validates: Requirements 4.3, 4.6, 4.7, 10.6, 14.6**

  - [ ] 10.3 Implement macro-target-history appending on effective changes
    - Append a `macro_target_history` row (with correct `source`) whenever an effective target change occurs (baseline change, automatic weekly average, macro-settings change); never overwrite prior rows
    - _Requirements: 6.7, 13.1, 13.2, 13.3, 13.4_

- [ ] 11. Checkpoint — data and state layers verified
  - Ensure all tests pass and state invariants hold, ask the user if questions arise.

- [ ] 12. Authentication and routing
  - [ ] 12.1 Implement AuthProvider, session persistence, and auth screens
    - Sign up (with client-side allowlist pre-check invoking the Edge Function), sign in, sign out, forgot-password flow; restore persistent sessions on reload; show errors on invalid credentials without a session
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2.5_

  - [ ] 12.2 Implement ProtectedRoute and app router
    - Redirect unauthenticated visitors to the auth entry point without rendering protected content; route to onboarding vs. main app based on `onboarding_completed`
    - _Requirements: 1.6, 3.1_

- [ ] 13. Onboarding flow
  - [ ] 13.1 Implement the OnboardingFlow screens
    - Collect required name/age/height/starting weight (field-level validation blocks completion), unit-system choice with imperial→canonical persistence, optional goal weight, optional Navy setup with Skip; set Auto Update OFF, persist `onboarding_completed = true`, and set Baseline_Weight
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 14. Calculator and dashboard screens
  - [ ] 14.1 Implement the CalculatorScreen sections
    - Personal Details, Body Measurements, Advanced Macro Settings (with Reset to Defaults), Nutrition Results, Macro Visualization, Body Composition Results, and Methodology; wire to the pure calc/validation layer; show carb-shortfall guidance and Navy inline errors/warnings; apply display rounding only
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.5, 8.5, 8.6, 8.7, 9.6, 19.2, 19.3, 19.4, 19.5_

  - [ ] 14.2 Implement the animated body-fat gauge
    - Sex-dependent horizontal gauge with moving pointer and category labels; convey status by more than color (accessible)
    - _Requirements: 9.4, 9.5_

  - [ ] 14.3 Implement the DashboardScreen with macro-source messaging
    - Animated calorie ring, macro bars, body-composition summary, and a macro-source banner distinguishing baseline-sourced vs. 7-day-average-sourced macros; expose baseline, active weight, latest average, effective date, and status
    - _Requirements: 12.8, 5.7_

- [ ] 15. Progress tracking, auto-update, goal, history, and charts
  - [ ] 15.1 Implement the Progress screen: add-weight form and rolling-average card
    - Add/edit today's weight (required positive weight + optional body fat) via upsert with duplicate-date edit and rapid-submit guard; show the 7-day average with measurement count; display rounded to 1 decimal
    - _Requirements: 10.1, 10.4, 10.5, 10.8, 11.5, 11.7_

  - [ ] 15.2 Implement the Auto Macro Update controls
    - Opt-in/opt-out toggle (OFF by default); on disable, offer the explicit choice to return to baseline or make current weight the new baseline (confirmed); surface qualification status reasons
    - _Requirements: 12.1, 12.2, 12.6, 12.9_

  - [ ] 15.3 Implement the Goal Progress card and Macro History list
    - Render goal progress (bar capped at 100%, true value retained, correct status) and the append-only macro target history; ensure goal changes never affect macros/baseline/active/multipliers/history
    - _Requirements: 14.5, 14.6, 13.1, 13.2, 13.3_

  - [ ] 15.4 Implement Recharts trend charts
    - Daily weight, 7-day average, body fat %, fat mass, lean body mass; selectable ranges (4wk/8wk/12wk/6mo/1yr/All); baseline/active/goal reference lines; empty states; chronological order; never connect/fabricate missing body-composition points; summaries only where data exists
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [ ] 16. Reminders and account deletion
  - [ ] 16.1 Implement the optional reminder settings with honest degradation
    - OFF by default, require explicit opt-in plus notification permission, disableable; degrade gracefully and honestly explain limits when reliable background notifications are unavailable; no secret backend; do not re-prompt after denial
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ] 16.2 Implement the account-deletion UI (Danger Zone)
    - Deliberate confirmation and, where practical, recent re-authentication; invoke the deletion Edge Function; only after verified success sign out, clear caches/service-worker storage, return to unauthenticated state; on failure show a retryable error with unchanged state
    - _Requirements: 17.1, 17.4, 17.5_

- [ ] 17. Design system, branding, theming, accessibility, and PWA
  - [ ] 17.1 Implement the design system tokens and Framer Motion animations
    - Apply visual tokens from `videoframe_167.png` (backgrounds, card surfaces with 24px radius + soft shadow, dual-tone gradient feature cards, elevated `+` FAB, EVOLVE/FITNESS brand type); implement circular progress arc, number count-ups, staggered card entrances, and `whileTap` micro-interactions
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 24.1, 24.2, 24.3_

  - [ ] 17.2 Implement the AppShell navigation with the JPEG logo and theme toggle
    - Display the Logo_Asset referencing the JPEG `3D_mobile_.jpeg` from the repo root (NOT a PNG); bottom navigation on mobile transitioning to a sidebar on larger screens; dark/light mode toggle with mirrored tokens
    - _Requirements: 22.1, 22.2, 20.4, 21.4_

  - [ ] 17.3 Implement mobile/Android-first responsiveness and accessibility
    - Responsive from ~320px with no horizontal overflow and safe-area insets; 44–48px touch targets; no hover-only interactions; `inputMode` decimal/numeric; keyboard navigation and ARIA; accessible contrast and non-color-only status
    - _Requirements: 20.1, 20.2, 20.3, 20.5, 20.6_

  - [ ] 17.4 Implement the installable PWA (manifest + service worker)
    - Web app manifest (theme colors, `standalone`), service worker for app-shell caching and offline read of cached data, responsive viewport with safe-area insets; make only honest capability claims
    - _Requirements: 23.1, 23.2, 23.3, 23.4_

  - [ ] 17.5 Surface the disclaimer text
    - Display the estimates/limitations disclaimer and present `16.8 kcal/lb` as a configurable default multiplier, not a medically exact figure
    - _Requirements: 24.1, 24.2, 24.3_

- [ ] 18. Integration tests and production build verification
  - [ ]* 18.1 Write RLS cross-user isolation integration tests
    - **Property 15: RLS prevents cross-user access**
    - **Validates: Requirements 18.1, 18.2, 18.3**
    - Verify user A cannot select/update/delete user B's rows in any table against a local/ephemeral Supabase

  - [ ]* 18.2 Write trusted-boundary deletion and allowlist integration tests
    - **Property 16: Deletion requires authorization & only via trusted boundary**
    - **Validates: Requirements 17.2, 17.4, 2.4**
    - Verify clients cannot delete the auth user directly, deletion succeeds only via the service-role Edge Function after verified success, and the Edge Function enforces the email allowlist (P14)

  - [ ] 18.3 Verify the production build succeeds
    - Run the production build, resolve any type/build errors, and confirm a clean `build` output
    - _Requirements: 26.5_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; all non-`*` sub-tasks are required implementation.
- Property-based tests (P1–P14) use `fast-check` with a minimum of 100 iterations per property and MUST carry the tag `Feature: macro-body-composition-calculator, Property {number}: {property_text}` (R26.4).
- The pure calculation and validation layer is intentionally built and verified first so the verified 70 kg reference vector and all correctness properties anchor the rest of the build.
- Active-weight source selection lives in the state layer (Active_Weight_Selector), never inside the pure calculation functions (design interface-boundary rule).
- Deployment, Supabase project provisioning, and running the app manually are operational steps outside this coding plan; run `test`/`build` locally and deploy migrations/Edge Functions through your own Supabase tooling.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.3", "3.1", "3.3", "3.5", "4.1", "4.5", "5.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.5", "2.6", "2.7", "3.2", "3.4", "3.6", "4.2", "4.3", "4.6", "5.2", "5.3", "7.1"] },
    { "id": 4, "tasks": ["4.4", "7.2", "8.1", "8.2"] },
    { "id": 5, "tasks": ["9.1"] },
    { "id": 6, "tasks": ["10.1", "10.3"] },
    { "id": 7, "tasks": ["10.2", "12.1"] },
    { "id": 8, "tasks": ["12.2", "13.1"] },
    { "id": 9, "tasks": ["14.1", "14.2", "14.3", "15.1", "15.2", "15.3", "15.4", "16.1", "16.2"] },
    { "id": 10, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5"] },
    { "id": 11, "tasks": ["18.1", "18.2"] },
    { "id": 12, "tasks": ["18.3"] }
  ]
}
```
