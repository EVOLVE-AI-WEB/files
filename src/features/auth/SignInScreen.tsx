/**
 * Sign-in screen (Task 12.1). Establishes an authenticated session with valid
 * credentials (R1.2); invalid credentials show an error without a session
 * (R1.7). Links to sign-up and the forgot-password flow.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AuthField } from './AuthField';

export function SignInScreen() {
  const { signIn, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.ok) {
      // Land on the app root; the onboarding gate routes appropriately.
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
        <p className="text-slate-600">Sign in to your account.</p>
      </header>

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
        <AuthField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            clearError();
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
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="flex flex-col gap-2 text-sm text-slate-600">
        <Link to="/forgot-password" className="text-brand-navy underline">
          Forgot your password?
        </Link>
        <p>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-brand-navy underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
