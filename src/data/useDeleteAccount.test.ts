/**
 * Tests for useDeleteAccount (Task 16.2; R17.4, R17.5).
 *
 * The hook wraps the trusted `delete-account-and-data` Edge Function and must
 * report success ONLY on a verified server-confirmed success. Anything else — a
 * transport error, a non-2xx `error`, or a 2xx body without `success: true` —
 * must reject with a retryable Error and NEVER resolve successfully (no
 * premature success). `supabase.functions.invoke` is mocked; no network.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useDeleteAccount } from './useDeleteAccount';

const invoke = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invoke(...args),
    },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: 0 }, queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  invoke.mockReset();
});

describe('useDeleteAccount', () => {
  it('resolves only on a verified success response', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await result.current.mutateAsync();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invoke).toHaveBeenCalledWith('delete-account-and-data', { body: {} });
  });

  it('rejects (no premature success) when the body carries an error', async () => {
    invoke.mockResolvedValue({
      data: { error: 'Deletion could not be verified; please retry.' },
      error: null,
    });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow(
      /could not be verified/i,
    );
  });

  it('rejects on a transport/function error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow();
  });

  it('rejects a 2xx body missing success:true (never premature success)', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow();
  });
});
