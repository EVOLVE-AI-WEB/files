/**
 * Small labelled text-input used across the auth screens. Accessible by
 * default: an associated <label>, error text wired via aria-describedby, and
 * aria-invalid. Full design-system styling arrives in Task 17; the Tailwind
 * classes here are reasonable, mobile-first defaults.
 */
import { useId, type InputHTMLAttributes } from 'react';

type AuthFieldProps = {
  label: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthField({ label, error, id, ...rest }: AuthFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-brand-navy">
        {label}
      </label>
      <input
        id={inputId}
        className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-base text-brand-navy outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
