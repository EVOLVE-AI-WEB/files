import { QueryClient } from '@tanstack/react-query';

/**
 * Application-wide React Query client.
 *
 * Server data (`profiles`, `macro_settings`, `progress_entries`,
 * `macro_target_history`) is cached here; mutations invalidate the relevant
 * keys (see the hooks in this folder). Retries are conservative — RLS/permission
 * failures are not worth retrying — and refetch-on-focus is disabled to avoid
 * surprising re-reads while a user edits a form.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** Shared singleton client used by the app entry point. */
export const queryClient = createAppQueryClient();
