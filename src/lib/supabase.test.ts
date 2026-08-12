/**
 * Tests for crash-safe Supabase client initialization (Bug 3 fix; R18.6, R2.4,
 * R3.8).
 *
 * `@supabase/supabase-js` createClient is mocked so nothing hits the network,
 * and `import.meta.env` is stubbed per case. The module is re-imported with a
 * fresh module registry each time so its top-level init re-runs.
 *
 * Contract:
 *  - Missing / empty / placeholder env → module does NOT throw at load, exposes
 *    a defined client, flags isSupabaseConfigured=false, and warns once, while
 *    only ever passing the public URL + anon key (never a service-role key).
 *  - Valid credentials → real client created with the SAME auth options.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createClient = vi.fn((..._args: unknown[]) => ({
  auth: {},
  functions: {},
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

const SAME_AUTH_OPTIONS = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
};

describe('supabase client initialization', () => {
  beforeEach(() => {
    createClient.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not throw and exposes a degraded client when env is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('./supabase');

    expect(mod.supabase).toBeDefined();
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    // A syntactically valid placeholder URL + dummy anon key are used, with the
    // same auth options; no service-role/DB secret is ever passed.
    expect(createClient).toHaveBeenCalledWith(
      'https://placeholder.supabase.co',
      expect.any(String),
      expect.objectContaining(SAME_AUTH_OPTIONS),
    );
    warn.mockRestore();
  });

  it('treats obvious placeholder values as unconfigured (no throw)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://your-project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'your-anon-key-placeholder');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('./supabase');

    expect(mod.supabase).toBeDefined();
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('creates the real client with the same auth options for valid credentials', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://real-project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'real-anon-key-abc123');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('./supabase');

    expect(mod.isSupabaseConfigured).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    expect(createClient).toHaveBeenCalledWith(
      'https://real-project.supabase.co',
      'real-anon-key-abc123',
      SAME_AUTH_OPTIONS,
    );
    warn.mockRestore();
  });
});
