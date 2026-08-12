/**
 * AccountDeletion — the Danger Zone (Task 16.2; R17.1, R17.4, R17.5).
 *
 * Permanently deletes the account and all associated data through a trusted
 * server boundary. The destructive action is deliberate: it takes two steps
 * plus a type-to-confirm gate (the user must type the confirmation word) before
 * the final button is enabled (R17.1).
 *
 * The actual deletion runs via `onDelete`, which invokes the
 * `delete-account-and-data` Edge Function and resolves ONLY on verified
 * server-side success. On success the parent (ProfileScreen) signs out and
 * clears caches/service-worker storage. On failure this component keeps its
 * state unchanged and shows a retryable error — success is never reported
 * prematurely (R17.5).
 *
 * The action is visually distinct (red) but also clearly labelled in text
 * ("Danger zone", "Delete account & data", explicit warnings), so status is
 * never conveyed by color alone (R20.6).
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/** The exact word the user must type to arm the final delete button. */
export const CONFIRM_WORD = 'DELETE';

type AccountDeletionProps = {
  /** The signed-in user's email, shown so the user confirms the right account. */
  userEmail?: string | null;
  /**
   * Perform the verified deletion. Must resolve ONLY on confirmed server
   * success and reject with an Error (retryable) otherwise.
   */
  onDelete: () => Promise<void>;
};

export function AccountDeletion({ userEmail, onDelete }: AccountDeletionProps) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function startConfirming() {
    setConfirming(true);
    setError(null);
  }

  function cancel() {
    setConfirming(false);
    setTyped('');
    setError(null);
  }

  async function handleDelete() {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      // Success: the parent tears down the session; nothing else to do here.
    } catch (err) {
      // Failure: leave everything unchanged and offer a retry (R17.5).
      setError(
        err instanceof Error
          ? err.message
          : 'Account deletion could not be completed. Please try again.',
      );
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="flex flex-col gap-4 rounded-card border-2 border-red-200 bg-white p-5 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="danger-zone-heading"
          className="flex items-center gap-2 text-lg font-semibold text-red-700"
        >
          <AlertTriangle aria-hidden="true" className="h-5 w-5 text-red-700" />
          Danger zone
        </h2>
        <p className="text-sm text-slate-600">
          Permanently delete your account and all associated data
          {userEmail ? (
            <>
              {' '}
              for <span className="font-medium">{userEmail}</span>
            </>
          ) : null}
          . This cannot be undone.
        </p>
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={startConfirming}
          className="min-h-[48px] w-fit rounded-xl border-2 border-red-600 px-5 text-base font-semibold text-red-700"
        >
          Delete account &amp; data
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            To confirm, type{' '}
            <span className="font-mono font-semibold text-red-700">
              {CONFIRM_WORD}
            </span>{' '}
            below. Your data is removed on our servers first; you are only signed
            out after deletion is verified.
          </p>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="sr-only">Type {CONFIRM_WORD} to confirm</span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              aria-label={`Type ${CONFIRM_WORD} to confirm`}
              autoComplete="off"
              className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-base text-brand-navy disabled:opacity-60"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error} You can try again — nothing has been changed.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={!armed || busy}
              className="min-h-[48px] rounded-xl bg-red-600 px-5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? 'Deleting…'
                : error
                  ? 'Retry permanent deletion'
                  : 'Permanently delete'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="min-h-[48px] rounded-xl border border-slate-300 px-5 text-base font-medium text-brand-navy disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
