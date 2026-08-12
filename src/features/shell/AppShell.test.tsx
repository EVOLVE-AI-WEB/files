/**
 * Tests for the AppShell + BrandLogo (Task 17.2; R22.1, R22.2, R20.4).
 *
 * Verifies the shell renders the Evolve Fitness brand wordmark, the primary
 * navigation links (Dashboard / Calculator / Progress / Profile), and — the
 * key branding contract — that the logo is referenced as the JPEG asset
 * (`.jpeg`, never a `.png`) with the alt text "Evolve Fitness" (R22.2).
 *
 * The shell uses <NavLink>/useNavigate and the theme toggle, so it is rendered
 * inside a MemoryRouter and a ThemeProvider.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { BrandLogo } from './BrandLogo';
import { ThemeProvider } from './ThemeProvider';

function renderShell() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('BrandLogo', () => {
  it('references the JPEG logo (not a PNG) with the correct alt text', () => {
    render(<BrandLogo />);
    const logo = screen.getByAltText('Evolve Fitness') as HTMLImageElement;
    // The src attribute must point at the JPEG asset (R22.2).
    const src = logo.getAttribute('src') ?? '';
    expect(src.endsWith('.jpeg')).toBe(true);
    expect(src).toMatch(/3D_mobile_\.jpeg$/);
    expect(src.endsWith('.png')).toBe(false);
  });

  it('renders the EVOLVE / FITNESS wordmark', () => {
    render(<BrandLogo />);
    expect(screen.getByText('EVOLVE')).toBeInTheDocument();
    expect(screen.getByText('FITNESS')).toBeInTheDocument();
  });
});

describe('AppShell', () => {
  it('renders the brand logo as a JPEG in the navigation', () => {
    renderShell();
    const logos = screen.getAllByAltText('Evolve Fitness');
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) {
      expect((logo.getAttribute('src') ?? '').endsWith('.jpeg')).toBe(true);
    }
  });

  it('renders the primary navigation links', () => {
    renderShell();
    // Sidebar + bottom-bar both render the links, so there are multiples.
    const navs = screen.getAllByRole('navigation', { name: /primary/i });
    expect(navs.length).toBeGreaterThan(0);
    const firstNav = navs[0] as HTMLElement;
    expect(
      within(firstNav).getByRole('link', { name: /dashboard/i }),
    ).toBeInTheDocument();
    for (const label of ['Calculator', 'Progress', 'Profile']) {
      expect(
        screen.getAllByRole('link', { name: new RegExp(label, 'i') }).length,
      ).toBeGreaterThan(0);
    }
  });

  it('exposes the theme toggle and the FAB', () => {
    renderShell();
    expect(
      screen.getAllByRole('button', { name: /switch to (dark|light) mode/i })
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: /open calculator/i }),
    ).toBeInTheDocument();
  });

  it('surfaces the estimates/limitations disclaimer', () => {
    renderShell();
    expect(
      screen.getByText(/calculations provide estimates/i),
    ).toBeInTheDocument();
    // The 16.8 kcal/lb multiplier is framed as a configurable default (R24.3).
    expect(screen.getByText(/16\.8 kcal\/lb/i)).toBeInTheDocument();
  });
});
