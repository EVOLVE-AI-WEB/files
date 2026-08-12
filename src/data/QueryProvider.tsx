import type { ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient as defaultQueryClient } from './queryClient';

type QueryProviderProps = {
  children: ReactNode;
  /** Override the client (used by tests to provide an isolated instance). */
  client?: QueryClient;
};

/**
 * Wraps the application in the React Query context. Uses the shared singleton
 * client by default; tests may inject their own to keep caches isolated.
 */
export function QueryProvider({ children, client }: QueryProviderProps) {
  return (
    <QueryClientProvider client={client ?? defaultQueryClient}>
      {children}
    </QueryClientProvider>
  );
}
