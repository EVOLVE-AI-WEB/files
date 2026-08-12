/**
 * Tests for ThemeProvider + ThemeToggle (Task 17.2; R21.4, R20.4).
 *
 * Verifies the light/dark toggle actually flips the `dark` class on <html>
 * (which drives the mirrored design-system tokens) and persists the choice to
 * localStorage. Also checks the toggle is an accessible, labelled control with
 * aria-pressed reflecting state (status not conveyed by color alone).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark', 'light');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark', 'light');
});

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle withLabel />
    </ThemeProvider>,
  );
}

describe('ThemeToggle', () => {
  it('defaults to light mode (no stored preference, no OS dark pref)', () => {
    renderToggle();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    // Labelled control that offers switching to dark.
    expect(
      screen.getByRole('button', { name: /switch to dark mode/i }),
    ).toBeInTheDocument();
  });

  it('toggles the dark class on <html> and persists the choice', async () => {
    const user = userEvent.setup();
    renderToggle();

    const toggle = screen.getByRole('button', {
      name: /switch to dark mode/i,
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('evolve-theme')).toBe('dark');
    // The control now offers the reverse action and reflects pressed state.
    const backToLight = screen.getByRole('button', {
      name: /switch to light mode/i,
    });
    expect(backToLight).toHaveAttribute('aria-pressed', 'true');

    await user.click(backToLight);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('evolve-theme')).toBe('light');
  });

  it('restores a persisted dark preference on mount', () => {
    localStorage.setItem('evolve-theme', 'dark');
    renderToggle();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
