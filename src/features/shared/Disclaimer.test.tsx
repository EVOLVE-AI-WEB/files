/**
 * Tests for the shared Disclaimer (Task 17.5; R24.1–24.3).
 *
 * Confirms the estimates/limitations disclaimer is surfaced and that the
 * 16.8 kcal/lb value is framed as a configurable default multiplier (not a
 * medically exact figure). The `compact` variant omits the multiplier note.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Disclaimer } from './Disclaimer';

describe('Disclaimer', () => {
  it('surfaces the estimates + limitations disclaimer and multiplier note', () => {
    render(<Disclaimer />);
    expect(
      screen.getByText(/calculations provide estimates/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not medical diagnoses/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/16\.8 kcal\/lb.*configurable default/i),
    ).toBeInTheDocument();
  });

  it('omits the multiplier note in the compact variant', () => {
    render(<Disclaimer compact />);
    expect(
      screen.getByText(/calculations provide estimates/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/16\.8 kcal\/lb/i)).not.toBeInTheDocument();
  });
});
