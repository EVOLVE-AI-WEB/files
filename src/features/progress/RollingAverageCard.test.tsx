/**
 * Tests for RollingAverageCard (Task 15.1; R11.5, R11.7).
 *
 * The card must surface both the 7-day average (rounded to one decimal) AND the
 * measurement count that produced it, and must communicate honestly when fewer
 * than a full window of days were logged. Pure presentational props — no hooks.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RollingAverageResult } from '../../types';
import { RollingAverageCard } from './RollingAverageCard';

describe('RollingAverageCard', () => {
  it('shows the average with its measurement count', () => {
    const rolling: RollingAverageResult = {
      averageKg: 72.44, // -> "72.4"
      measurementCount: 6,
      windowDays: 7,
      endDate: '2024-05-08',
    };
    render(<RollingAverageCard rollingAverage={rolling} />);

    expect(
      screen.getByText(/7-day average: 72\.4 kg · 6 measurements/),
    ).toBeInTheDocument();
    // Fewer than 7 measurements is communicated clearly.
    expect(
      screen.getByText(/Based on the 6 days you logged/),
    ).toBeInTheDocument();
  });

  it('uses singular wording for a single measurement', () => {
    const rolling: RollingAverageResult = {
      averageKg: 70,
      measurementCount: 1,
      windowDays: 7,
      endDate: '2024-05-08',
    };
    render(<RollingAverageCard rollingAverage={rolling} />);
    expect(
      screen.getByText(/7-day average: 70\.0 kg · 1 measurement\b/),
    ).toBeInTheDocument();
  });

  it('renders an honest empty state when there is no data', () => {
    const rolling: RollingAverageResult = {
      averageKg: null,
      measurementCount: 0,
      windowDays: 7,
      endDate: '2024-05-08',
    };
    render(<RollingAverageCard rollingAverage={rolling} />);
    expect(
      screen.getByText(/Log a weight to see your 7-day rolling average/),
    ).toBeInTheDocument();
  });
});
