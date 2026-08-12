/**
 * Tests for the ProtectedRoute guard (Task 12.2).
 *
 * The Supabase client module is mocked so importing the guard (which pulls in
 * the profile data hook) never evaluates real env config. These tests exercise
 * the redirect behaviour directly by supplying an AuthContext value.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../auth/AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

function makeAuthValue(
  overrides: Partial<AuthContextValue>,
): AuthContextValue {
  return {
    session: null,
    user: null,
    loading: false,
    error: null,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function renderWithAuth(value: AuthContextValue) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route path="/signin" element={<div>Sign in page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/secret" element={<div>Secret content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated visitor to /signin without rendering protected content', () => {
    renderWithAuth(makeAuthValue({ user: null, loading: false }));

    expect(screen.getByText('Sign in page')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('shows a loading state (no redirect) while the session is being restored', () => {
    renderWithAuth(makeAuthValue({ user: null, loading: true }));

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Sign in page')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', () => {
    const user = { id: 'user-1', email: 'a@gmail.com' } as AuthContextValue['user'];
    renderWithAuth(makeAuthValue({ user, loading: false }));

    expect(screen.getByText('Secret content')).toBeInTheDocument();
    expect(screen.queryByText('Sign in page')).not.toBeInTheDocument();
  });
});
