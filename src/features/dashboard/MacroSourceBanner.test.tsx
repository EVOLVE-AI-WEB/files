/**
 * Tests for the macro-source banner (Task 14.3; R12.8).
 *
 * The banner must render the EXACT baseline-sourced vs. 7-day-average-sourced
 * messaging and expose the weight-source facts. These are pure presentational
 * props, so no hooks/Supabase are involved.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MacroSourceBanner } from './MacroSourceBanner';

describe('MacroSourceBanner', () => {
  it('renders baseline-sourced messaging with one-decimal weight', () => {
    render(
      <MacroSourceBanner
        source="baseline"
        activeWeightKg={70}
        baselineWeightKg={70}
        latestAverageKg={null}
        effectiveDate="2024-05-01"
        status="Macros based on your baseline weight of 70 kg"
      />,
    );

    expect(
      screen.getByText('Macros based on your baseline weight of 70.0 kg'),
    ).toBeInTheDocument();
    // Latest average with no data is surfaced honestly, never fabricated.
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
    expect(screen.getByText('2024-05-01')).toBeInTheDocument();
  });

  it('renders 7-day-average-sourced messaging with one-decimal weight', () => {
    render(
      <MacroSourceBanner
        source="rolling_average"
        activeWeightKg={71.2}
        baselineWeightKg={70}
        latestAverageKg={71.2}
        effectiveDate="2024-05-08"
        status="Updated this week"
      />,
    );

    expect(
      screen.getByText(
        'Updated for this week based on your 7-day average weight of 71.2 kg',
      ),
    ).toBeInTheDocument();
  });
});
