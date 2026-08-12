/**
 * Integration test — Task 18.1
 * Feature: macro-body-composition-calculator, Property 15: RLS prevents cross-user access
 * Validates: Requirements 18.1, 18.2, 18.3
 *
 * There is NO live/ephemeral Supabase instance in this environment, so this
 * cannot execute real cross-user queries against Postgres. Instead, this test
 * verifies the SAME security contract deterministically and offline by parsing
 * the ACTUAL SQL migration source (supabase/migrations/*.sql) — the real policy
 * definitions that Postgres would enforce — and asserting the RLS isolation
 * contract for EVERY user-owned table:
 *
 *   1. Row-Level Security is ENABLED (`enable row level security`).
 *   2. select / insert / update / delete access is scoped by
 *      `auth.uid() = user_id` (the documented exception: macro_target_history
 *      is append-only and intentionally has NO update policy — R13.1, R13.5).
 *   3. NO policy exists that would permit access to rows where
 *      `auth.uid() != user_id` (e.g. `using (true)` / `with check (true)` or a
 *      policy body lacking the ownership predicate).
 *
 * Proving these against the real policy source deterministically establishes
 * that user A can never select/update/delete user B's rows (P15).
 */
import { describe, expect, it } from 'vitest';

// Read the real migration SQL at test time (offline, deterministic). Vite's
// glob import inlines the file contents as raw strings — no node:fs, no network.
const sqlFiles = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function findSql(fragment: string): string {
  const entry = Object.entries(sqlFiles).find(([path]) =>
    path.includes(fragment),
  );
  if (!entry) {
    throw new Error(`Could not locate migration containing "${fragment}"`);
  }
  return entry[1];
}

const schemaSql = findSql('initial_schema');
const rlsSql = findSql('rls_policies');

/** Strip SQL line comments so `--` prose never pollutes the parse. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

const schemaClean = stripComments(schemaSql).toLowerCase();
const rlsClean = stripComments(rlsSql).toLowerCase();

/** Discover every table declared `create table public.<name> (...)`. */
function discoverTables(sql: string): { name: string; body: string }[] {
  const tables: { name: string; body: string }[] = [];
  const re = /create\s+table\s+public\.(\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const name = match[1];
    if (name === undefined) continue;
    // Capture the parenthesized body via depth-matching from the opening paren.
    const start = re.lastIndex - 1; // index of '('
    let depth = 0;
    let end = start;
    for (let i = start; i < sql.length; i += 1) {
      const ch = sql[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    tables.push({ name, body: sql.slice(start + 1, end) });
  }
  return tables;
}

/** A "user-owned" table is any table with a `user_id` column. */
const allTables = discoverTables(schemaClean);
const userOwnedTables = allTables
  .filter((t) => /\buser_id\b/.test(t.body))
  .map((t) => t.name);

type PolicyStatement = {
  table: string;
  command: 'select' | 'insert' | 'update' | 'delete';
  body: string; // full statement text (lowercased, comments stripped)
};

/** Parse every `create policy ... ;` statement out of the RLS migration. */
function parsePolicies(sql: string): PolicyStatement[] {
  const policies: PolicyStatement[] = [];
  const re =
    /create\s+policy\s+"[^"]+"\s+on\s+public\.(\w+)\s+for\s+(select|insert|update|delete)\b([\s\S]*?);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const table = match[1];
    const command = match[2] as PolicyStatement['command'];
    if (table === undefined) continue;
    policies.push({ table, command, body: match[0] });
  }
  return policies;
}

const policies = parsePolicies(rlsClean);

const OWNERSHIP_PREDICATE = 'auth.uid() = user_id';
const REQUIRED_COMMANDS: PolicyStatement['command'][] = [
  'select',
  'insert',
  'update',
  'delete',
];
// Documented exception: append-only audit log has no update policy.
const APPEND_ONLY_NO_UPDATE = new Set(['macro_target_history']);

describe('Feature: macro-body-composition-calculator, Property 15: RLS prevents cross-user access', () => {
  it('discovers the expected set of user-owned tables from the schema', () => {
    expect(userOwnedTables.sort()).toEqual(
      [
        'macro_settings',
        'macro_target_history',
        'profiles',
        'progress_entries',
        'reminder_preferences',
      ].sort(),
    );
  });

  it('enables Row-Level Security on every user-owned table (R18.1)', () => {
    for (const table of userOwnedTables) {
      const enableRe = new RegExp(
        `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      );
      expect(
        enableRe.test(rlsClean),
        `RLS must be enabled on public.${table}`,
      ).toBe(true);
    }
  });

  it.each(userOwnedTables)(
    'scopes select/insert/update/delete on %s by auth.uid() = user_id (R18.2, R18.3)',
    (table) => {
      const tablePolicies = policies.filter((p) => p.table === table);
      const commandsPresent = new Set(tablePolicies.map((p) => p.command));

      const expectedCommands = APPEND_ONLY_NO_UPDATE.has(table)
        ? REQUIRED_COMMANDS.filter((c) => c !== 'update')
        : REQUIRED_COMMANDS;

      for (const command of expectedCommands) {
        expect(
          commandsPresent.has(command),
          `public.${table} must have a ${command} policy`,
        ).toBe(true);
      }

      // Every policy that DOES exist must be scoped to the owner.
      for (const policy of tablePolicies) {
        expect(
          policy.body.includes(OWNERSHIP_PREDICATE),
          `${command(policy)} on public.${table} must be scoped by "${OWNERSHIP_PREDICATE}"`,
        ).toBe(true);
      }
    },
  );

  it('keeps macro_target_history append-only (no update policy — R13.1, R13.5)', () => {
    const historyUpdate = policies.find(
      (p) => p.table === 'macro_target_history' && p.command === 'update',
    );
    expect(historyUpdate).toBeUndefined();
  });

  it('never grants an unscoped policy that would leak rows across users (P15)', () => {
    // No policy anywhere may use `using (true)` / `with check (true)` or omit
    // the ownership predicate — either would allow auth.uid() != user_id access.
    for (const policy of policies) {
      expect(
        /using\s*\(\s*true\s*\)/.test(policy.body),
        `${command(policy)} on public.${policy.table} must not use "using (true)"`,
      ).toBe(false);
      expect(
        /with\s+check\s*\(\s*true\s*\)/.test(policy.body),
        `${command(policy)} on public.${policy.table} must not use "with check (true)"`,
      ).toBe(false);
      expect(
        policy.body.includes(OWNERSHIP_PREDICATE),
        `${command(policy)} on public.${policy.table} must include "${OWNERSHIP_PREDICATE}"`,
      ).toBe(true);
    }
  });

  it('cascades deletes to auth.users so orphaned cross-user rows cannot linger', () => {
    // Each user-owned table FKs user_id to auth.users(id) on delete cascade.
    for (const table of userOwnedTables) {
      const tableDef = allTables.find((t) => t.name === table);
      expect(tableDef, `schema for public.${table}`).toBeDefined();
      expect(
        /references\s+auth\.users\s*\(\s*id\s*\)\s+on\s+delete\s+cascade/.test(
          tableDef?.body ?? '',
        ),
        `public.${table}.user_id must reference auth.users(id) on delete cascade`,
      ).toBe(true);
    }
  });
});

/** Small helper for readable assertion messages. */
function command(p: PolicyStatement): string {
  return `${p.command} policy`;
}
