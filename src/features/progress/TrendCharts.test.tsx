/**
 * Empty-state tests for the trend charts (Task 15.4; R15.4, R15.5).
 *
 * When a chart has no data for the selected range it must show an honest empty
 * state rather than a fabricated chart. The body-composition charts additionally
 * treat a range with weight-only entries (no body-fat measurements) as empty.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BodyCompPoint } from './chartData';
import { WeightTrendChart } from './WeightTrendChart';
import { BodyFatTrendChart } from './BodyFatTrendChart';
import { FatLeanTrendChart } from './FatLeanTrendChart';

describe('trend chart empty states', () => {
  it('WeightTrendChart shows an empty state with no points', () => {
    render(
      <WeightTrendChart
        points={[]}
        baselineWeightKg={70}
        activeWeightKg={70}
        goalWeightKg={null}
      />,
    );
    expect(
      screen.getByText(/no weight entries in this range yet/i),
    ).toBeInTheDocument();
  });

  it('BodyFatTrendChart shows an empty state when no body-fat data exists', () => {
    // Weight-only points (no body fat) count as no body-fat data.
    const points: BodyCompPoint[] = [
      {
        date: '2024-05-01',
        label: 'May 1',
        bodyFatPercentage: null,
        fatMassKg: null,
        leanMassKg: null,
      },
    ];
    render(<BodyFatTrendChart points={points} />);
    expect(
      screen.getByText(/no body-fat measurements in this range yet/i),
    ).toBeInTheDocument();
  });

  it('FatLeanTrendChart shows an empty state when no body-fat data exists', () => {
    render(<FatLeanTrendChart points={[]} />);
    expect(
      screen.getByText(/no body-fat measurements in this range yet/i),
    ).toBeInTheDocument();
  });
});
