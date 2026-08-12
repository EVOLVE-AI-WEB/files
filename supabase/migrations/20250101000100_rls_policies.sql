-- =============================================================================
-- Migration: 20250101000100_rls_policies
-- Feature:   Macro & Body Composition Calculator (Evolve Fitness)
-- Task:       7.2 — Row-Level Security enablement and policies
-- Requirements: 18.1, 18.2, 18.3, 13.1, 13.5
--
-- Enables RLS on every table and restricts all access to rows owned by the
-- authenticated caller (auth.uid() = user_id). This is the authoritative
-- isolation boundary (Correctness_Property P15): user A can never
-- select/insert/update/delete user B's rows.
--
-- macro_target_history is APPEND-ONLY in practice: select/insert/delete
-- policies are granted, but NO update policy — prior audit rows can never be
-- overwritten (R13.1, R13.5).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles - own rows - select" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles - own rows - insert" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles - own rows - update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles - own rows - delete" on public.profiles
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- macro_settings
-- -----------------------------------------------------------------------------
alter table public.macro_settings enable row level security;

create policy "macro_settings - own rows - select" on public.macro_settings
  for select using (auth.uid() = user_id);
create policy "macro_settings - own rows - insert" on public.macro_settings
  for insert with check (auth.uid() = user_id);
create policy "macro_settings - own rows - update" on public.macro_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "macro_settings - own rows - delete" on public.macro_settings
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- progress_entries
-- -----------------------------------------------------------------------------
alter table public.progress_entries enable row level security;

create policy "progress_entries - own rows - select" on public.progress_entries
  for select using (auth.uid() = user_id);
create policy "progress_entries - own rows - insert" on public.progress_entries
  for insert with check (auth.uid() = user_id);
create policy "progress_entries - own rows - update" on public.progress_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress_entries - own rows - delete" on public.progress_entries
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- macro_target_history — APPEND-ONLY
-- select / insert / delete only. Intentionally NO update policy (R13.1, R13.5)
-- so historical audit rows can never be mutated. Delete is scoped to the owner
-- so account/data deletion still cascades cleanly.
-- -----------------------------------------------------------------------------
alter table public.macro_target_history enable row level security;

create policy "macro_target_history - own rows - select"
  on public.macro_target_history
  for select using (auth.uid() = user_id);
create policy "macro_target_history - own rows - insert"
  on public.macro_target_history
  for insert with check (auth.uid() = user_id);
create policy "macro_target_history - own rows - delete"
  on public.macro_target_history
  for delete using (auth.uid() = user_id);
-- NOTE: no "for update" policy is defined on purpose (append-only audit log).

-- -----------------------------------------------------------------------------
-- reminder_preferences
-- -----------------------------------------------------------------------------
alter table public.reminder_preferences enable row level security;

create policy "reminder_preferences - own rows - select"
  on public.reminder_preferences
  for select using (auth.uid() = user_id);
create policy "reminder_preferences - own rows - insert"
  on public.reminder_preferences
  for insert with check (auth.uid() = user_id);
create policy "reminder_preferences - own rows - update"
  on public.reminder_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reminder_preferences - own rows - delete"
  on public.reminder_preferences
  for delete using (auth.uid() = user_id);
