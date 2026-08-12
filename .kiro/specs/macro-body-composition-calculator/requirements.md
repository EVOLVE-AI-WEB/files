# Requirements Document

## Introduction

The **Macro & Body Composition Calculator** (Evolve Fitness) is an Android-mobile-first, installable Progressive Web App (PWA) that calculates daily bulking/surplus macronutrient targets, BMI, U.S. Navy body-fat percentage, fat mass, and lean body mass. It supports authenticated accounts, a persistent baseline profile, daily morning-weight logging, a 7-day rolling weight average, optional automatic weekly macro updates, goal-weight progress, body-composition trend charts, optional reminders, and secure account/data deletion.

These requirements are **derived from the approved design document** (`design.md`), which is the authoritative source of truth (design-first workflow). Each requirement is written to be testable, follows EARS patterns, and — where relevant — references the design's executable correctness properties (P1–P16), the exact calculation formulas, and the non-negotiable five-concept data-separation invariants.

The single most important architectural theme carried forward from the design is the strict separation of **five distinct weight concepts** (baseline, daily progress logs, 7-day rolling average, active macro-calculation weight, and goal weight). Calculation logic is pure and side-effect-free, receiving an explicitly selected active weight; the selection of *which* weight feeds the macro formulas happens outside the calculation layer and is never an implicit side effect of logging a weigh-in.

Canonical stored units are **kg (weight), cm (height/circumference), and % (body fat)**. Conversions occur only for display and input. Intermediate calculation values are **never** rounded; rounding is applied only at display time.

The application intentionally does **not** include food logging, meal tracking, barcode scanning, or workout/water/sleep/step tracking.

## Glossary

- **System**: The Macro & Body Composition Calculator PWA (client + Supabase server boundary), unless a more specific component is named.
- **Auth_Service**: Supabase Authentication (email + password, sessions).
- **Signup_Domain_Validator**: The trusted server-boundary component (Supabase Edge Function `validate-signup-domain` and/or DB trigger) that authoritatively enforces the email-domain allowlist.
- **Client_Email_Validator**: `validateAllowedEmailDomain` used client-side for UX pre-check only.
- **Onboarding_Flow**: The first-time setup experience collecting baseline profile data.
- **Macro_Calculator**: The pure calculation layer function `calculateMacros(activeCalculationWeightKg, settings)` and its helpers.
- **Active_Weight_Selector**: The state-layer selector that chooses the Active_Macro_Weight from Baseline_Weight or the 7-day Rolling_Average, per the Auto Update rule, before any macro calculation.
- **BMI_Calculator**: `calculateBMI` and `getBMICategory`.
- **Navy_Calculator**: `calculateMaleNavyBodyFat` / `calculateFemaleNavyBodyFat`.
- **Body_Composition_Calculator**: `calculateFatMass`, `calculateLeanBodyMass`, `getBodyFatCategory`.
- **Rolling_Average_Calculator**: `calculateRollingWeightAverage`.
- **Auto_Update_Qualifier**: `isAutoMacroUpdateQualified`.
- **Goal_Progress_Calculator**: `calculateGoalProgress`.
- **Progress_Tracker**: The daily morning-weight logging feature and its state/data-access flow.
- **Macro_History_Store**: The append-only `macro_target_history` audit log.
- **Reminder_Service**: The optional "Body Composition Check-In" reminder feature.
- **Account_Deletion_Service**: The trusted server-boundary component (Supabase Edge Function `delete-account-and-data`) that deletes the auth user and cascades data.
- **Data_Store**: Supabase PostgreSQL with Row-Level Security (RLS) enabled on every table.
- **Baseline_Weight**: Concept A — `profile.baseline_weight_kg`; persistent reference; the macro weight when Auto Update is OFF.
- **Progress_Entry**: Concept B — a row in `progress_entries` (a daily morning-weight observation).
- **Rolling_Average**: Concept C — `derived.currentRollingAverageKg`; derived from valid entries in the last 7 calendar days.
- **Active_Macro_Weight**: Concept D — `macro.activeCalculationWeightKg` (persisted `active_macro_weight_kg`); the only weight fed to macro formulas.
- **Goal_Weight**: Concept E — `profile.goal_weight_kg`; a progress target for display only.
- **Macro_Settings**: `{ calorieMultiplier, proteinMultiplier, fatMultiplier }`, defaults 16.8 / 1.0 / 0.4.
- **Canonical_Units**: kg for weight, cm for height/circumference, % for body fat.
- **Design_System**: The visual tokens and animation specs derived from `videoframe_167.png`.
- **Logo_Asset**: The JPEG brand logo file `3D_mobile_.jpeg` present in the repository root (a JPEG, not a PNG).
- **Correctness_Property (P1–P16)**: The executable/property-based correctness statements defined in Part III of the design.

## Requirements

### Requirement 1: Email + Password Authentication

**User Story:** As a user, I want to create and access my account with email and password, so that my fitness data is private, persistent, and available across sessions.

#### Acceptance Criteria

1. WHEN a visitor submits a sign-up request with a valid email and password, THE Auth_Service SHALL create an account via Supabase email + password authentication.
2. WHEN a registered user submits valid credentials to sign in, THE Auth_Service SHALL establish an authenticated session.
3. WHEN an authenticated user signs out, THE System SHALL terminate the session and return the user to the unauthenticated state.
4. WHILE a user has an unexpired persistent session, THE System SHALL restore the authenticated state on application reload without requiring re-entry of credentials.
5. WHEN a user initiates the forgot-password flow with an email address, THE Auth_Service SHALL trigger the Supabase password-reset process for that address.
6. IF an unauthenticated visitor requests a protected route, THEN THE System SHALL redirect to the authentication entry point and SHALL NOT render protected content.
7. IF sign-in credentials are invalid, THEN THE Auth_Service SHALL reject the attempt and THE System SHALL display an error message without establishing a session.

### Requirement 2: Restricted Sign-Up Email Domains (Server-Enforced Allowlist)

**User Story:** As a service operator, I want sign-up restricted to an exact allowlist of email providers enforced on a trusted server boundary, so that account creation cannot be bypassed by client tampering or look-alike domains.

#### Acceptance Criteria

1. THE Signup_Domain_Validator SHALL permit sign-up only when the email domain, parsed as the substring after the **final** `@`, exactly matches one of `gmail.com`, `yahoo.com`, `outlook.com`, `hotmail.com`, `icloud.com`.
2. THE Signup_Domain_Validator SHALL perform allowlist matching case-insensitively by lowercasing the parsed domain before comparison.
3. IF a sign-up email domain is a look-alike or superset such as `gmail.co`, `fakegmail.com`, or `gmail.com.example.com`, THEN THE Signup_Domain_Validator SHALL reject the request and SHALL NOT create an account (validates Correctness_Property P14).
4. THE Signup_Domain_Validator SHALL enforce the allowlist at a trusted server boundary (Supabase Edge Function `validate-signup-domain` and/or DB trigger) and SHALL be authoritative even when the client check is bypassed.
5. WHERE a client-side pre-check is provided for user experience, THE Client_Email_Validator SHALL validate the domain using the same exact-match, case-insensitive, final-`@` parsing rule, while the server boundary remains authoritative.
6. IF the email string does not contain exactly one parseable `@` structure, THEN THE Signup_Domain_Validator SHALL treat the email as invalid and reject the request.

### Requirement 3: First-Time Onboarding

**User Story:** As a new user, I want a guided first-time setup, so that my baseline profile is established before I use the calculators.

#### Acceptance Criteria

1. WHEN an authenticated user has not completed onboarding, THE Onboarding_Flow SHALL collect name, age, height, and starting (baseline) weight before granting access to the main application.
2. THE Onboarding_Flow SHALL allow the user to choose a preferred unit system of either `metric` or `imperial`.
3. WHERE the user enters values in imperial units, THE System SHALL persist the values converted to Canonical_Units (kg, cm).
4. THE Onboarding_Flow SHALL allow the user to optionally provide a goal weight.
5. THE Onboarding_Flow SHALL allow the user to optionally complete Navy body-fat setup (neck, waist, and hip for female) and SHALL provide a Skip option for this step.
6. WHEN onboarding completes, THE System SHALL set the Auto Macro Update preference to OFF (disabled) by default.
7. WHEN onboarding completes, THE System SHALL persist `onboarding_completed = true` and set the Baseline_Weight from the entered starting weight.
8. IF a required onboarding field (name, age, height, or starting weight) is missing or fails validation, THEN THE Onboarding_Flow SHALL prevent completion and SHALL display a field-level error.

### Requirement 4: Five-Concept Weight Data-Model Separation (Non-Negotiable Invariants)

**User Story:** As a system architect, I want the five weight concepts modeled as strictly distinct fields/derivations, so that macro calculations remain correct, predictable, and never corrupted by conflating observations, references, derivations, and targets.

#### Acceptance Criteria

1. THE System SHALL represent Baseline_Weight (A), Progress_Entry weights (B), Rolling_Average (C), Active_Macro_Weight (D), and Goal_Weight (E) as distinct fields or derivations that are never conflated.
2. THE Active_Weight_Selector SHALL select the Active_Macro_Weight in the state layer before invoking any macro calculation, and THE Macro_Calculator SHALL receive the Active_Macro_Weight as an explicit argument (validates Correctness_Property P1).
3. WHILE Auto Macro Update is disabled, THE Active_Weight_Selector SHALL set Active_Macro_Weight equal to Baseline_Weight (validates Correctness_Property P9).
4. WHILE Auto Macro Update is enabled AND a qualifying Rolling_Average exists, THE Active_Weight_Selector SHALL set Active_Macro_Weight equal to the qualifying Rolling_Average (validates Correctness_Property P10).
5. IF Auto Macro Update is enabled but no qualifying Rolling_Average exists, THEN THE Active_Weight_Selector SHALL retain the previous Active_Macro_Weight unchanged and surface a status message.
6. WHEN a single daily weigh-in is logged, THE System SHALL NOT set that entry's weight as the Active_Macro_Weight and SHALL leave the Baseline_Weight unchanged (validates Correctness_Properties P7, P8).
7. THE System SHALL NOT source the Active_Macro_Weight from the Goal_Weight under any automatic path (validates Correctness_Property P11).
8. THE System SHALL change the Baseline_Weight only through a deliberate, confirmed user edit and SHALL NEVER auto-overwrite it.

### Requirement 5: Daily Macro Calculator (Exact Formulas)

**User Story:** As a user pursuing a bulk/surplus, I want daily calorie and macronutrient targets computed from precise formulas, so that my targets are accurate and reproducible.

#### Acceptance Criteria

1. THE Macro_Calculator SHALL convert the active weight to pounds using `weightLb = activeCalculationWeightKg * 2.20462` without rounding the intermediate.
2. THE Macro_Calculator SHALL compute `totalCalories = weightLb * calorieMultiplier` (default multiplier 16.8).
3. THE Macro_Calculator SHALL compute `proteinGrams = weightLb * proteinMultiplier` (default multiplier 1.0).
4. THE Macro_Calculator SHALL compute `fatGrams = weightLb * fatMultiplier` (default multiplier 0.4).
5. THE Macro_Calculator SHALL compute carbohydrates from remaining calories as `carbGrams = (totalCalories - proteinGrams*4 - fatGrams*9) / 4`, and SHALL NEVER compute carbs directly from bodyweight (validates Correctness_Property P2).
6. THE Macro_Calculator SHALL NOT round any intermediate value; rounding SHALL occur only at display time (validates Correctness_Property P3).
7. WHEN the active weight is 70 kg with default multipliers, THE Macro_Calculator SHALL produce `weightLb = 154.3234`, `totalCalories = 2592.63312`, `proteinGrams = 154.3234`, `fatGrams = 61.72936`, and `carbGrams = 354.94382`, displayed as 2,593 kcal, 154 g protein, 62 g fat, and 355 g carbs.
8. THE Macro_Calculator SHALL be deterministic such that identical `(activeCalculationWeightKg, settings)` inputs always yield identical results, independent of which of the five weight concepts supplied the weight (validates Correctness_Property P1).
9. THE Macro_Calculator SHALL satisfy the energy-balance postcondition `proteinGrams*4 + fatGrams*9 + carbGrams*4 ≈ totalCalories` within floating-point tolerance when no carb shortfall exists.

### Requirement 6: Custom Macro Parameters

**User Story:** As an advanced user, I want to customize and reset my macro multipliers, so that I can tailor targets while keeping my baseline and history intact.

#### Acceptance Criteria

1. THE System SHALL persist Macro_Settings with default multipliers of 16.8 (calorie), 1.0 (protein), and 0.4 (fat).
2. THE System SHALL provide a "Reset to Defaults" action that restores the multipliers to 16.8 / 1.0 / 0.4.
3. THE `validateMacroSettings` function SHALL reject non-positive multipliers and multipliers outside the bounds calorie ≤ 40, protein ≤ 3, and fat ≤ 2, returning a list of errors.
4. IF `proteinCalories + fatCalories > totalCalories`, THEN THE Macro_Calculator SHALL set `isCarbShortfall = true`, set `carbGrams = 0` (never negative), and set a `guidanceMessage` advising the user to increase the calorie multiplier or reduce protein/fat multipliers (validates Correctness_Property P2).
5. WHEN the user changes macro parameters, THE Macro_Calculator SHALL recalculate using the current Active_Macro_Weight.
6. WHEN the user changes macro parameters, THE System SHALL NOT alter Baseline_Weight, Progress_Entry data, Rolling_Average, or Goal_Weight.
7. WHEN a macro parameter change results in an effective target change, THE Macro_History_Store SHALL append a `macro_target_history` row with source `macro_settings_change`.

### Requirement 7: BMI Calculator

**User Story:** As a user, I want a BMI value with an appropriate category, so that I can understand a screening-level view of my weight status.

#### Acceptance Criteria

1. THE BMI_Calculator SHALL compute `bmi = weightKg / (heightCm/100)^2`.
2. WHEN the user's age is 20 or older, THE BMI_Calculator SHALL classify BMI using adult screening categories: Underweight (< 18.5), Healthy (< 25.0), Overweight (< 30.0), Obesity Class I (< 35.0), Obesity Class II (< 40.0), and Obesity Class III (≥ 40.0).
3. IF the user's age is under 20, THEN THE BMI_Calculator SHALL NOT apply adult categories and SHALL return a BMI-for-age percentile note instead.
4. THE System SHALL present BMI as a screening measure and SHALL NOT present it as a medical diagnosis.
5. THE System SHALL display BMI rounded to 1 decimal place while retaining full precision internally.

### Requirement 8: U.S. Navy Body Fat Calculation

**User Story:** As a user, I want a circumference-based body-fat estimate, so that I can track body composition without specialized equipment.

#### Acceptance Criteria

1. THE Navy_Calculator SHALL operate on inches by converting circumference and height inputs using `inches = cm / 2.54` and SHALL use `Math.log10` (validates Correctness_Property P5).
2. THE Navy_Calculator SHALL compute male body fat as `86.010 * log10(waistIn - neckIn) - 70.041 * log10(heightIn) + 36.76`.
3. THE Navy_Calculator SHALL compute female body fat as `163.205 * log10(waistIn + hipIn - neckIn) - 97.684 * log10(heightIn) - 78.387`.
4. BEFORE invoking `log10`, THE `validateNavyMeasurements` function SHALL verify that all measurements are positive, that `waistIn - neckIn > 0` for males and `waistIn + hipIn - neckIn > 0` for females, and that no value is NaN or Infinity.
5. IF Navy inputs fail pre-log10 validation, THEN THE System SHALL display inline field errors and SHALL NOT render a body-fat result.
6. WHERE Navy inputs are unusual but valid, THE System SHALL display a non-blocking warning while still rendering the result.
7. THE System SHALL display the resulting body-fat percentage rounded to 1 decimal place while retaining full precision internally.

### Requirement 9: Body Composition (Fat Mass & Lean Body Mass)

**User Story:** As a user, I want derived fat mass and lean body mass with a clear category, so that I can interpret my body composition, but only when valid body-fat data exists.

#### Acceptance Criteria

1. WHEN a valid body-fat percentage is available, THE Body_Composition_Calculator SHALL derive `fatMass = weightKg * (bodyFatPercentage/100)` and `leanBodyMass = weightKg - fatMass` (validates Correctness_Property P13).
2. IF no valid body-fat percentage is available, THEN THE System SHALL omit fat mass and lean body mass and SHALL NOT fabricate values (validates Correctness_Property P13).
3. THE Body_Composition_Calculator SHALL classify body fat using ACE-style, source-identified categories — Men: Essential 2–5, Athletes 6–13, Fitness 14–17, Average 18–24, Obese 25+; Women: Essential 10–13, Athletes 14–20, Fitness 21–24, Average 25–31, Obese 32+.
4. THE System SHALL render an animated, sex-dependent horizontal body-fat gauge with a moving pointer and category labels.
5. THE body-fat gauge SHALL convey status through means other than color alone (accessible, not color-only).
6. THE System SHALL display fat mass and lean body mass rounded to 1 decimal place while retaining full precision internally.

### Requirement 10: Daily Morning Weight Tracker

**User Story:** As a user, I want to log my morning weight once per day, so that I build an accurate history of observations without accidental duplicates.

#### Acceptance Criteria

1. WHEN a user submits a Progress_Entry, THE Progress_Tracker SHALL require a date and a positive weight, and SHALL accept an optional body-fat percentage.
2. THE Progress_Tracker SHALL persist weight in kg, height/circumference in cm, and body fat in % (Canonical_Units).
3. THE Data_Store SHALL enforce a UNIQUE constraint on `(user_id, logged_date)` so that at most one entry exists per user per date.
4. IF a Progress_Entry already exists for the submitted date, THEN THE Progress_Tracker SHALL offer to edit the existing entry rather than insert a duplicate.
5. THE Progress_Tracker SHALL guard against rapid duplicate submissions of the same entry.
6. WHEN a Progress_Entry is written (insert, update, or delete), THE System SHALL leave the Baseline_Weight invariant (validates Correctness_Property P8).
7. THE `validateProgressEntry` function SHALL reject entries with a missing or non-positive weight, or a body-fat percentage outside the range 0–75, returning a list of errors.
8. WHEN a Progress_Entry is written, THE System SHALL recompute the derived Rolling_Average.

### Requirement 11: 7-Day Rolling Weight Average

**User Story:** As a user, I want a rolling 7-day weight average that honestly reflects only the days I logged, so that trends are meaningful and never distorted by missing data.

#### Acceptance Criteria

1. THE Rolling_Average_Calculator SHALL include only valid weight entries whose `loggedDate` falls within the most recent `windowDays` (default 7) calendar days ending at and including the specified end date.
2. THE Rolling_Average_Calculator SHALL ignore missing days and SHALL NEVER treat a missing day as zero or fabricate a value (validates Correctness_Property P6).
3. WHEN at least one valid measurement exists in the window, THE Rolling_Average_Calculator SHALL return `averageKg = sum(weights) / count` computed at full precision, along with the `measurementCount` used.
4. IF no valid measurements exist in the window, THEN THE Rolling_Average_Calculator SHALL return `averageKg = null` and `measurementCount = 0`.
5. THE Rolling_Average_Calculator SHALL report the number of measurements used so the UI can communicate the count clearly.
6. WHEN a Progress_Entry is edited or deleted, THE System SHALL recompute affected Rolling_Average values because they are derived on read.
7. THE System SHALL display the Rolling_Average rounded to 1 decimal place while retaining full precision internally.

### Requirement 12: Optional Auto Macro Update

**User Story:** As a user, I want an optional automatic weekly macro update from my rolling average, so that my targets can track my trend without ever silently corrupting my baseline.

#### Acceptance Criteria

1. THE System SHALL set Auto Macro Update to OFF by default and SHALL require explicit user opt-in to enable it.
2. THE System SHALL allow the user to reverse (disable) Auto Macro Update at any time.
3. THE Auto_Update_Qualifier SHALL apply an automatic update at most once per weekly update period.
4. THE Auto_Update_Qualifier SHALL qualify an update only when a 7-day Rolling_Average exists with at least 4 valid measurements in the window (`AUTO_UPDATE_MIN_MEASUREMENTS = 4`) (validates Correctness_Property P10).
5. WHEN an automatic update qualifies, THE System SHALL set Active_Macro_Weight equal to the qualifying Rolling_Average and SHALL NOT modify the Baseline_Weight.
6. IF the measurement count is below the minimum OR an update already occurred in the current period, THEN THE Auto_Update_Qualifier SHALL NOT change the Active_Macro_Weight, SHALL retain the previous value, and SHALL surface a status reason.
7. THE Auto_Update_Qualifier SHALL NEVER estimate or fabricate data, treat missing days as zero, or use a single outlier measurement.
8. THE System SHALL display a clear macro-source message on the dashboard, distinguishing baseline-sourced macros (e.g., "Macros based on your baseline weight of 70.0 kg") from average-sourced macros (e.g., "Updated for this week based on your 7-day average weight of 71.2 kg"), and SHALL expose baseline, active weight, latest 7-day average, effective date, and status.
9. WHEN the user disables Auto Macro Update, THE System SHALL offer an explicit choice to either return the Active_Macro_Weight to the Baseline_Weight or make the current weight the new Baseline_Weight, requiring confirmation for the latter.

### Requirement 13: Macro Target History (Append-Only Audit)

**User Story:** As a user, I want an auditable history of my macro target changes, so that I can see when and why my targets changed over time.

#### Acceptance Criteria

1. WHEN an effective macro target change occurs, THE Macro_History_Store SHALL append a new `macro_target_history` row and SHALL NOT overwrite prior rows.
2. THE Macro_History_Store SHALL record the `source` of each row as one of `baseline`, `manual_baseline_change`, `automatic_weekly_average`, or `macro_settings_change`.
3. THE Macro_History_Store SHALL record the calculation weight, multipliers, and calculated targets (calories, protein, fat, carbs) for each row.
4. THE Macro_History_Store SHALL record macro **targets** and SHALL NOT record consumed food.
5. THE Data_Store SHALL NOT grant an update policy on `macro_target_history`, keeping it append-only in practice.

### Requirement 14: Goal Weight & Goal Progress

**User Story:** As a user, I want to set a goal weight and see honest progress toward it, so that I stay motivated without my macros or baseline being affected.

#### Acceptance Criteria

1. THE System SHALL store Goal_Weight and goal-start weight in kg (Canonical_Units).
2. THE Goal_Progress_Calculator SHALL compute `progressPercent = ((current - starting) / (goal - starting)) * 100`.
3. IF `starting == goal`, THEN THE Goal_Progress_Calculator SHALL set `progressPercent = null` without throwing (divide-by-zero guard) and SHALL classify status as `reached` when current equals goal or `undefined` otherwise (validates Correctness_Property P12).
4. THE Goal_Progress_Calculator SHALL classify status across the cases `gaining`, `losing`, `reached`, and `exceeded`, and SHALL clamp the display percent to the range [0, 100] while the underlying value may exceed 100 (validates Correctness_Property P12).
5. THE System SHALL cap the goal-progress bar at 100% while retaining the true underlying value.
6. THE System SHALL ensure that setting or changing the Goal_Weight never changes macros, Baseline_Weight, Active_Macro_Weight, multipliers, or Macro_History_Store rows (validates Correctness_Property P11).

### Requirement 15: Trend Charts

**User Story:** As a user, I want trend charts across selectable time ranges, so that I can visualize my progress honestly over time.

#### Acceptance Criteria

1. THE System SHALL provide trend charts for daily weight, 7-day rolling average, body fat %, fat mass, and lean body mass.
2. THE System SHALL provide selectable time ranges of 4 weeks, 8 weeks, 12 weeks, 6 months, 1 year, and All.
3. THE weight chart SHALL display reference lines for the Goal_Weight, the Active_Macro_Weight, and the Baseline_Weight, distinguished from raw daily and 7-day average series.
4. WHEN no data exists for a chart or range, THE System SHALL display an empty state rather than fabricated data.
5. THE System SHALL handle missing data honestly by not connecting or inventing unavailable body-composition points and SHALL order data chronologically.
6. THE System SHALL show summaries only where data exists.

### Requirement 16: Optional Body-Composition Reminders

**User Story:** As a user, I want optional check-in reminders that behave honestly about platform limits, so that I am nudged to log data without being misled about capabilities.

#### Acceptance Criteria

1. THE Reminder_Service SHALL be OFF by default and SHALL require explicit opt-in plus notification permission before scheduling reminders.
2. THE Reminder_Service SHALL allow the user to disable reminders at any time.
3. IF the PWA or browser cannot provide reliable background scheduled notifications, THEN THE Reminder_Service SHALL degrade gracefully and SHALL honestly explain the limitation.
4. THE Reminder_Service SHALL NOT falsely claim reliable background scheduled notifications and SHALL NOT secretly add a notification backend.
5. IF the user denies notification permission, THEN THE Reminder_Service SHALL NOT re-prompt for permission.

### Requirement 17: Secure Account & Data Deletion

**User Story:** As a user, I want to permanently delete my account and data through a safe, verified process, so that my privacy is respected and deletion is never falsely reported.

#### Acceptance Criteria

1. WHEN a user requests account deletion, THE System SHALL require a deliberate confirmation of the destructive action and, where practical, recent re-authentication.
2. THE Account_Deletion_Service SHALL perform deletion at a trusted server boundary (Supabase Edge Function `delete-account-and-data`) using the service-role key server-side only, and clients SHALL NOT be able to delete the auth user directly (validates Correctness_Property P16).
3. WHEN the auth user is deleted, THE Data_Store SHALL cascade-delete all associated rows via `on delete cascade` foreign keys.
4. THE System SHALL sign out, clear caches and service-worker storage, and return to the unauthenticated state ONLY AFTER verified server-side deletion success (validates Correctness_Property P16).
5. IF the server deletion operation is not verified as successful, THEN THE System SHALL surface a retryable error, SHALL leave state unchanged, and SHALL NOT report success prematurely.

### Requirement 18: Supabase Backend, Schema, Constraints & Row-Level Security

**User Story:** As a security-conscious user, I want my data isolated by strong database policies, so that no other user can access my records.

#### Acceptance Criteria

1. THE Data_Store SHALL enable Row-Level Security on every table.
2. THE Data_Store SHALL restrict select, insert, update, and delete on every table to rows where `auth.uid() = user_id`.
3. IF user A attempts to select, update, or delete user B's rows in any table, THEN THE Data_Store SHALL deny the operation (validates Correctness_Property P15).
4. THE Data_Store SHALL enforce CHECK constraints including age between 1 and 129, positive height/weight, body-fat percentage between 0 and 75 on progress entries, macro-settings multiplier bounds (calorie ≤ 40, protein ≤ 3, fat ≤ 2), and the `source` enum on `macro_target_history`.
5. THE Data_Store SHALL enforce the UNIQUE `(user_id, logged_date)` constraint on `progress_entries`.
6. THE client bundle SHALL contain only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and SHALL NEVER contain the service-role key or database password.

### Requirement 19: Rounding Policy

**User Story:** As a user, I want precise calculations with sensible display rounding, so that results are trustworthy and readable.

#### Acceptance Criteria

1. THE System SHALL NOT round any intermediate calculation value (validates Correctness_Property P3).
2. THE System SHALL display calories rounded to the nearest kcal.
3. THE System SHALL display protein, fat, and carbohydrate grams rounded to the nearest gram.
4. THE System SHALL display BMI, body-fat percentage, fat mass, lean body mass, and weight averages rounded to 1 decimal place.
5. WHERE rounded macro calories differ slightly from the sum of individually rounded macros, THE System SHALL NOT alter the underlying calculations to force a match.

### Requirement 20: Mobile/Android-First UX & Accessibility

**User Story:** As a mobile user, I want a responsive, accessible interface, so that the app is comfortable and usable on my phone and with assistive technology.

#### Acceptance Criteria

1. THE System SHALL render responsively from approximately 320px width with no horizontal overflow and SHALL honor safe-area insets.
2. THE System SHALL provide touch targets between 44px and 48px and SHALL NOT rely on hover-only interactions.
3. THE System SHALL set `inputMode="decimal"` for decimal input fields and `inputMode="numeric"` for integer input fields.
4. THE System SHALL present bottom navigation on mobile and transition to a sidebar on larger screens.
5. THE System SHALL support keyboard navigation and provide appropriate ARIA attributes.
6. THE System SHALL provide accessible color contrast and SHALL convey status through means other than color alone.

### Requirement 21: Design System & Animations

**User Story:** As a user, I want a polished, premium fitness-dashboard aesthetic, so that the experience matches the Evolve Fitness brand benchmark.

#### Acceptance Criteria

1. THE Design_System SHALL use a soft cool-gray/lavender app background `#F4F6FC` in light mode.
2. THE Design_System SHALL render white card surfaces (`#FFFFFF`) with 24px corner radius and a soft shadow `0 10px 30px rgba(0,0,0,0.04)`.
3. THE Design_System SHALL render dual-tone gradient feature cards (Coral→Peach, Sky Blue→Royal Blue, Magenta→Pink) with asymmetric top-corner radii and a centered elevated circular gradient `+` FAB with a soft glow.
4. THE Design_System SHALL render the brand type with "EVOLVE" in bold navy `#1C2038` and "FITNESS" in tracked slate gray, and SHALL support dark and light modes.
5. THE System SHALL animate a circular progress arc (clockwise SVG stroke fill, ~1.2s easeOut), number count-ups (0 → target, ~0.8s), staggered card entrances (translateY 20→0, opacity 0→1, ~0.08s stagger), and `whileTap` scale 0.96 micro-interactions using Framer Motion.

### Requirement 22: Branding / Logo Asset

**User Story:** As a user, I want the brand logo displayed in the navigation, so that the app is clearly identified as Evolve Fitness.

#### Acceptance Criteria

1. THE System SHALL display the Logo_Asset in the navigation header.
2. THE System SHALL reference the Logo_Asset as the JPEG file `3D_mobile_.jpeg` located in the repository root, and SHALL NOT reference it as a PNG.

### Requirement 23: Installable PWA

**User Story:** As a user, I want to install the app to my device, so that it behaves like a native app while making only honest capability claims.

#### Acceptance Criteria

1. THE System SHALL provide a web app manifest defining theme colors and a `standalone` display mode.
2. THE System SHALL register a service worker for app-shell caching and offline read of cached data.
3. THE System SHALL configure a responsive viewport and honor safe-area insets in the installed experience.
4. THE System SHALL make only honest claims about installed and offline capabilities and SHALL NOT overstate background or notification capabilities.

### Requirement 24: Disclaimer Surfacing

**User Story:** As a user, I want clear disclaimers about the nature of the estimates, so that I do not mistake them for medical advice.

#### Acceptance Criteria

1. THE System SHALL surface a disclaimer stating that calculations are estimates for informational and personal-planning purposes.
2. THE System SHALL state that BMI and circumference-based body-fat methods have limitations and are not medical diagnoses.
3. THE System SHALL present the `16.8 kcal/lb` value as a configurable default multiplier and SHALL NOT present it as a medically exact figure.

### Requirement 25: Non-Goals (Excluded Functionality)

**User Story:** As a product owner, I want the scope strictly bounded, so that the app stays focused on macro and body-composition calculation.

#### Acceptance Criteria

1. THE System SHALL NOT provide food logging or meal tracking.
2. THE System SHALL NOT provide barcode scanning.
3. THE System SHALL NOT provide workout, water, sleep, or step tracking.
4. THE Macro_History_Store SHALL record macro targets only and SHALL NOT record consumed food.

### Requirement 26: Testing Requirements

**User Story:** As an engineer, I want comprehensive automated tests and a successful production build, so that correctness and shippability are verifiable.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests (Vitest + React Testing Library) for every pure calculation and validation function, including the verified 70 kg reference vector (2,593 kcal / 154 g / 62 g / 355 g) and Navy fixtures.
2. THE test suite SHALL include property-based tests (e.g., `fast-check`, minimum 100 iterations per property) implementing Correctness_Properties P1 through P14.
3. THE test suite SHALL include integration tests verifying RLS cross-user isolation (Correctness_Property P15) and trusted-boundary account deletion (Correctness_Property P16), plus email-allowlist enforcement at the Edge Function (Correctness_Property P14).
4. EACH property-based test SHALL reference its design property using the tag format `Feature: macro-body-composition-calculator, Property {number}: {property_text}`.
5. THE production build SHALL succeed.
