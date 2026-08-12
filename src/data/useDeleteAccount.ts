/**
 * useDeleteAccount — invokes the trusted-boundary `delete-account-and-data`
 * Edge Function (Task 16.2; R17.2, R17.4, R17.5).
 *
 * The Edge Function uses the service-role key SERVER-SIDE ONLY to delete the
 * caller's auth user (data cascades via `on delete cascade` FKs). The client
 * can NEVER delete the auth user directly. This hook is a thin wrapper around
 * `supabase.functions.invoke` that surfaces a single, honest verdict:
 *
 *   - success ONLY when the function verified deletion server-side, and
 *   - a retryable error otherwise (transport failure, non-2xx, or a body that
 *     carries an `error`). It NEVER reports premature success.
 *
 * The caller (AccountDeletion) performs sign-out + cache/storage clear ONLY
 * after this resolves successfully.
 */
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/** Function response shape from `delete-account-and-data`. */
type DeleteAccountFnResponse = {
  success?: boolean;
  error?: string;
};

const GENERIC_DELETE_ERROR =
  'Account deletion could not be completed. Please try again.';

/**
 * Best-effort extraction of a human-readable message from a Supabase
 * FunctionsError. Non-2xx responses carry the original `Response` in
 * `error.context`; reading it can fail, so this never throws.
 */
async function friendlyFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as { json?: unknown }).json === 'function') {
    try {
      const body = (await (context as Response).json()) as {
        error?: string;
      };
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        return body.error;
      }
    } catch {
      // fall through to generic message
    }
  }
  return GENERIC_DELETE_ERROR;
}

/**
 * Mutation that requests verified account + data deletion. Resolves only on a
 * confirmed server success; otherwise it rejects with a retryable Error so the
 * caller keeps its state unchanged and shows a retry affordance (R17.5).
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      let data: DeleteAccountFnResponse | null = null;
      let invokeError: unknown = null;
      try {
        const invoked = await supabase.functions.invoke(
          'delete-account-and-data',
          { body: {} },
        );
        data = invoked.data as DeleteAccountFnResponse | null;
        invokeError = invoked.error;
      } catch (thrown) {
        invokeError = thrown;
      }

      // Transport / non-2xx error — surface a retryable message, never success.
      if (invokeError) {
        throw new Error(await friendlyFunctionError(invokeError));
      }

      // A 2xx body that still carries an error is a failure, not success.
      if (data && typeof data.error === 'string' && data.error.length > 0) {
        throw new Error(data.error);
      }

      // Only an explicit, verified success is treated as success (R17.4).
      if (!data || data.success !== true) {
        throw new Error(GENERIC_DELETE_ERROR);
      }
    },
  });
}
