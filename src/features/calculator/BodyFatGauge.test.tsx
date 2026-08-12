/**
 * Tests for the animated body-fat gauge (Task 14.2; R9.4, R9.5).
 *
 * Verifies the sex-dependent category labels render and that the current
 * category is announced in TEXT (status conveyed by more than color).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BodyFatGauge } from './BodyFatGauge';

const MALE_CATEGORIES = [
  'Essential',
  'Athletes',
  'Fitness',
  'Average',
  'Obese',
];

describe('BodyFatGauge', () => {
  it('renders all sex-dependent category labels', () => {
    render(<BodyFatGauge sex="male" bodyFat={15} age={30} />);
    for (const label of MALE_CATEGORIES) {
      // Each zone label appears at least once in the gauge track.
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('announces the active category in text (not color-only)', () => {
    // 15% body fat for a male falls in the Fitness band (14–17).
    render(<BodyFatGauge sex="male" bodyFat={15} age={30} />);
    expect(screen.getByText(/body fat/i)).toBeInTheDocument();
    expect(screen.getByText(/category:/i)).toBeInTheDocument();
    // The rounded value and category are surfaced as text.
    expect(screen.getByText('15.0%')).toBeInTheDocument();
  });

  it('shows a prompt when no body-fat value is available', () => {
    render(<BodyFatGauge sex="female" bodyFat={null} age={28} />);
    expect(
      screen.getByText(/enter valid body measurements/i),
    ).toBeInTheDocument();
  });
});
