/**
 * Forgot-password screen (Task 12.1). Triggers the Supabase password-reset
 * flow for the entered address (R1.5). To avoid leaking which addresses have
 * accounts, a generic confirmation is shown on success.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AuthField } from './AuthField';

export function ForgotPasswordScreen() {
  const { resetPassword, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = await resetPassword(email);
    setSubmitting(false);
    if (result.ok) {
      setSent(true);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-brand-navy">Reset password</h1>
        <p className="text-slate-600">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </header>

      {sent ? (
        <p role="status" className="text-sm text-brand-navy">
          If an account exists for that email, a password-reset link has been
          sent. Check your inbox.
        </p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <AuthField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              clearError();
              setEmail(e.target.value);
            }}
            required
          />

          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[48px] rounded-xl bg-brand-navy px-4 text-base font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="text-sm text-slate-600">
        <Link to="/signin" className="text-brand-navy underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
