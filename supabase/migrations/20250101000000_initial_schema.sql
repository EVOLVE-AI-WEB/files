-- =============================================================================
-- Migration: 20250101000000_initial_schema
-- Feature:   Macro & Body Composition Calculator (Evolve Fitness)
-- Task:       7.1 — Tables, CHECK constraints, keys, indexes
-- Requirements: 10.2, 10.3, 18.4, 18.5, 13.2
--
-- Canonical stored units (never conflated with display/input units):
--   * weight            -> kg
--   * height/circumference -> cm
--   * body fat          -> %
--
-- This migration authors the five domain tables faithful to the illustrative
-- DDL in design.md (Database Schema & RLS). It creates all CHECK constraints,
-- the UNIQUE(user_id, logged_date) guard on progress_entries, on-delete-cascade
-- foreign keys to auth.users (so account deletion cascades all data), a shared
-- updated_at trigger, and supporting indexes. Row-Level Security enablement and
-- policies live in the companion migration 20250101000100_rls_policies.sql
-- (task 7.2).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger function
-- Keeps `updated_at` honest on every row mutation. Kept simple; columns still
-- default to now() on insert.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- Concept A (baseline_weight_kg) and Concept E (goal_weight_kg / goal_start)
-- live here alongside the persisted Concept D (active_macro_weight_kg) and the
-- Auto Macro Update preference. These are distinct columns and are never
-- conflated (five-concept separation invariant, R4).
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  -- R18.4: age between 1 and 129 (inclusive).
  age int check (age >= 1 and age <= 129),
  biological_sex text check (biological_sex in ('male', 'female')),
  preferred_unit text not null default 'metric'
    check (preferred_unit in ('metric', 'imperial')),
  -- R18.4: positive height/weight.
  height_cm numeric check (height_cm > 0),
  baseline_weight_kg numeric check (baseline_weight_kg > 0),
  -- Optional Navy circumference measurements (canonical cm).
  neck_cm numeric check (neck_cm is null or neck_cm > 0),
  waist_cm numeric check (waist_cm is null or waist_cm > 0),
  hip_cm numeric check (hip_cm is null or hip_cm > 0),
  -- Concept E: goal weight is a progress target for display only.
  goal_weight_kg numeric check (goal_weight_kg is null or goal_weight_kg > 0),
  goal_start_weight_kg numeric
    check (goal_start_weight_kg is null or goal_start_weight_kg > 0),
  goal_created_at timestamptz,
  -- Auto Macro Update is OFF by default (R12.1).
  auto_macro_update_enabled boolean not null default false,
  -- Concept D: the only weight fed to the macro formulas. Selected in the
  -- state layer (Active_Weight_Selector), never derived inside the DB.
  active_macro_weight_kg numeric
    check (active_macro_weight_kg is null or active_macro_weight_kg > 0),
  last_auto_macro_update_at timestamptz,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- macro_settings — 1:1 with auth.users
-- Multiplier defaults 16.8 / 1.0 / 0.4 with bounds calorie<=40, protein<=3,
-- fat<=2 and strict positivity (R18.4, R6.1, R6.3).
-- -----------------------------------------------------------------------------
create table public.macro_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calorie_multiplier numeric not null default 16.8
    check (calorie_multiplier > 0 and calorie_multiplier <= 40),
  protein_multiplier numeric not null default 1.0
    check (protein_multiplier > 0 and protein_multiplier <= 3),
  fat_multiplier numeric not null default 0.4
    check (fat_multiplier > 0 and fat_multiplier <= 2),
  updated_at timestamptz not null default now()
);

create trigger macro_settings_set_updated_at
  before update on public.macro_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- progress_entries — 1:many with auth.users (Concept B)
-- Daily morning-weight observations. At most one entry per user per date via
-- UNIQUE(user_id, logged_date) (R10.3, R18.5). A single entry never mutates the
-- baseline; the 7-day rolling average is derived on read (never stored here).
-- -----------------------------------------------------------------------------
create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_date date not null,
  -- R18.4: positive weight.
  weight_kg numeric not null check (weight_kg > 0),
  -- R18.4: body fat between 0 and 75 (nullable — optional).
  body_fat_percentage numeric
    check (
      body_fat_percentage is null
      or (body_fat_percentage >= 0 and body_fat_percentage <= 75)
    ),
  body_fat_method text
    check (body_fat_method is null or body_fat_method in ('manual', 'navy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- R10.3 / R18.5: one entry per user per date.
  unique (user_id, logged_date)
);

create trigger progress_entries_set_updated_at
  before update on public.progress_entries
  for each row execute function public.set_updated_at();

-- Common access pattern: a user's entries ordered by date (rolling-average and
-- trend-chart reads walk the most-recent window per user).
create index progress_entries_user_date_idx
  on public.progress_entries (user_id, logged_date desc);

-- -----------------------------------------------------------------------------
-- macro_target_history — 1:many with auth.users (append-only audit log)
-- Records macro TARGETS (not consumed food, R13.4). `source` is a constrained
-- enum (R13.2). No UPDATE policy is granted in the RLS migration, keeping this
-- append-only in practice (R13.1, R13.5).
-- -----------------------------------------------------------------------------
create table public.macro_target_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_date date not null,
  calculation_weight_kg numeric not null check (calculation_weight_kg > 0),
  -- R13.2: constrained source enum.
  source text not null check (
    source in (
      'baseline',
      'manual_baseline_change',
      'automatic_weekly_average',
      'macro_settings_change'
    )
  ),
  rolling_average_kg numeric,
  calorie_multiplier numeric not null,
  protein_multiplier numeric not null,
  fat_multiplier numeric not null,
  calculated_calories numeric not null,
  calculated_protein_g numeric not null,
  calculated_fat_g numeric not null,
  calculated_carbs_g numeric not null,
  created_at timestamptz not null default now()
);

-- History reads are per-user in reverse-chronological order.
create index macro_target_history_user_date_idx
  on public.macro_target_history (user_id, effective_date desc);

-- -----------------------------------------------------------------------------
-- reminder_preferences — 0..1 with auth.users
-- Optional "Body Composition Check-In" reminders. OFF by default (R16.1).
-- -----------------------------------------------------------------------------
create table public.reminder_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  check_in_schedule text,
  updated_at timestamptz not null default now()
);

create trigger reminder_preferences_set_updated_at
  before update on public.reminder_preferences
  for each row execute function public.set_updated_at();
