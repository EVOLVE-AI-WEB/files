/**
 * Application router (Task 12.2).
 *
 * Public auth routes (/signin, /signup, /forgot-password) are wrapped so
 * already-authenticated users are bounced to the app. Everything else sits
 * behind <ProtectedRoute>, which redirects unauthenticated visitors to /signin
 * without rendering protected content (R1.6). Inside the protected area,
 * <RequireOnboarding> routes users to /onboarding until onboarding_completed is
 * true; the /onboarding route itself is guarded by <OnboardingGate> so it is
 * skipped once setup is done (R3.1).
 *
 * The Dashboard/Calculator/Progress/Profile screens are placeholders here and
 * are replaced by the real screens in later tasks (14, 15, 17).
 */
import { Route, Routes, Navigate } from 'react-router-dom';
import {
  OnboardingGate,
  ProtectedRoute,
  RedirectIfAuthenticated,
  RequireOnboarding,
} from './routing/ProtectedRoute';
import { SignInScreen } from './features/auth/SignInScreen';
import { SignUpScreen } from './features/auth/SignUpScreen';
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import {
  PlaceholderShell,
  ProfilePlaceholder,
} from './features/placeholders/PlaceholderScreens';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import { CalculatorScreen } from './features/calculator/CalculatorScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';

function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route
        path="/signin"
        element={
          <RedirectIfAuthenticated>
            <SignInScreen />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthenticated>
            <SignUpScreen />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <RedirectIfAuthenticated>
            <ForgotPasswordScreen />
          </RedirectIfAuthenticated>
        }
      />

      {/* Authenticated area */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/onboarding"
          element={
            <OnboardingGate>
              <OnboardingFlow />
            </OnboardingGate>
          }
        />

        {/* Main app — only reachable once onboarding is complete */}
        <Route element={<RequireOnboarding />}>
          <Route element={<PlaceholderShell />}>
            <Route index element={<DashboardScreen />} />
            <Route path="/calculator" element={<CalculatorScreen />} />
            <Route path="/progress" element={<ProgressScreen />} />
            <Route path="/profile" element={<ProfilePlaceholder />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
