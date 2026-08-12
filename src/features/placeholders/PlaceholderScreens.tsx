/**
 * Temporary placeholder screens + shell for the authenticated app (Task 12.2).
 *
 * These exist only so the protected routes render something meaningful after
 * auth + onboarding. The real Dashboard, Calculator, Progress, and Profile
 * screens (and the polished AppShell navigation) are implemented in later
 * tasks (14, 15, 17), which will replace these placeholders. Nothing here
 * encodes business logic beyond simple navigation and sign-out.
 */
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/calculator', label: 'Calculator', end: false },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/profile', label: 'Profile', end: false },
] as const;

/**
 * Minimal responsive shell: bottom navigation on mobile, sidebar on larger
 * screens. A deliberately simple stand-in for the Task 17 AppShell.
 */
export function PlaceholderShell() {
  return (
    <div className="min-h-full bg-app-bg text-brand-navy sm:flex">
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white sm:static sm:w-56 sm:flex-col sm:border-r sm:border-t-0"
      >
        <div className="hidden p-4 text-lg font-bold sm:block">
          <span className="text-brand-navy">EVOLVE</span>{' '}
          <span className="tracking-widest text-slate-500">FITNESS</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-[48px] flex-1 items-center justify-center px-4 text-sm font-medium sm:justify-start ${
                isActive ? 'text-brand-navy' : 'text-slate-500'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 pb-16 sm:pb-0">
        <Outlet />
      </main>
    </div>
  );
}

function PlaceholderScreen({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="text-2xl font-bold text-brand-navy">{title}</h1>
      <p className="text-slate-600">
        This screen is coming soon. It will be implemented in a later task.
      </p>
      {children}
    </div>
  );
}

export function DashboardPlaceholder() {
  return <PlaceholderScreen title="Dashboard" />;
}

export function CalculatorPlaceholder() {
  return <PlaceholderScreen title="Calculator" />;
}

export function ProgressPlaceholder() {
  return <PlaceholderScreen title="Progress" />;
}

export function ProfilePlaceholder() {
  const { user, signOut } = useAuth();
  return (
    <PlaceholderScreen title="Profile">
      <p className="text-sm text-slate-400">Signed in as {user?.email}</p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="min-h-[48px] w-fit rounded-xl bg-brand-navy px-4 text-base font-semibold text-white"
      >
        Sign out
      </button>
    </PlaceholderScreen>
  );
}
