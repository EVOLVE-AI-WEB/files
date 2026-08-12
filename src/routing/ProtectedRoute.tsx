/**
 * Routing guards (Task 12.2).
 *
 * - ProtectedRoute: redirects unauthenticated visitors to the auth entry point
 *   WITHOUT rendering protected content (R1.6).
 * - RequireOnboarding: for authenticated users, routes to onboarding vs. the
 *   main app based on `profile.onboarding_completed` (R3.1).
 * - RedirectIfAuthenticated: keeps signed-in users off the auth screens.
 *
 * The guards render nested routes via <Outlet />, so no protected element is
 * ever mounted while a redirect condition holds.
 */
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../data/useProfile';

/** Small, dependency-free loading placeholder shown during async gating. */
function RouteLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-full items-center justify-center p-6 text-slate-500"
    >
      {label}
    </div>
  );
}

/**
 * Gate that requires an authenticated session. While the session is being
 * restored we show a loading state; unauthenticated users are redirected to
 * /signin and the protected outlet is never rendered.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <RouteLoading label="Loading…" />;
  }

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/**
 * Gate (nested under ProtectedRoute) that routes based on onboarding status.
 * Authenticated users who have not completed onboarding are sent to
 * /onboarding; everyone else sees the requested main-app route.
 */
export function RequireOnboarding() {
  const { user } = useAuth();
  const profileQuery = useProfile(user?.id);

  if (profileQuery.isLoading) {
    return <RouteLoading label="Loading your profile…" />;
  }

  const onboardingCompleted = profileQuery.data?.onboardingCompleted === true;
  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

/**
 * Wraps the onboarding route: if onboarding is already complete, bounce to the
 * app root so users cannot re-run setup.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const profileQuery = useProfile(user?.id);

  if (profileQuery.isLoading) {
    return <RouteLoading label="Loading your profile…" />;
  }

  if (profileQuery.data?.onboardingCompleted === true) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Wraps the public auth screens: signed-in users are redirected to the app
 * root (the onboarding gate then decides onboarding vs. main app).
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteLoading label="Loading…" />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
