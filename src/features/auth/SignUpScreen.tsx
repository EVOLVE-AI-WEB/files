/**
 * Sign-up screen (Task 12.1). Runs the client-side allowlist pre-check
 * (validateAllowedEmailDomain) for immediate UX feedback before calling
 * signUp, which invokes the authoritative validate-signup-domain Edge Function
 * (R2.1–2.6). The Edge Function remains the source of truth even if this
 * pre-check is bypassed; the client check exists only to improve UX.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { validateAllowedEmailDomain } from '../../validation/validators';
import { AuthField } from './AuthField';

const MIN_PASSWORD_LENGTH = 6;

export function SignUpScreen() {
  const { signUp, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Client-side allowlist pre-check (UX only; server is authoritative).
    const nextErrors: { email?: string; password?: string } = {};
    const emailCheck = validateAllowedEmailDomain(email);
    if (!emailCheck.valid) {
      nextErrors.email = emailCheck.reason ?? 'Email domain is not permitted';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      // Do not attempt account creation when the pre-check fails.
      return;
    }

    setSubmitting(true);
    const result = await signUp(email, password);
    setSubmitting(false);
    if (result.ok) {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          <span className="text-brand-navy">EVOLVE</span>{' '}
          <span className="tracking-widest text-slate-500">FITNESS</span>
        </h1>
        <p className="text-slate-600">Create your account.</p>
        <p className="text-xs text-slate-400">
          Use an email from gmail.com, yahoo.com, outlook.com, hotmail.com, or
          icloud.com.
        </p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <AuthField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          error={fieldErrors.email}
          onChange={(e) => {
            clearError();
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
            setEmail(e.target.value);
          }}
          required
        />
        <AuthField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          onChange={(e) => {
            clearError();
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
            setPassword(e.target.value);
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
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/signin" className="text-brand-navy underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
