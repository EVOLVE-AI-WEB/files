/**
 * Tests for GoalProgressCard (Task 15.3; R14.4, R14.5).
 *
 * The progress bar must cap at 100% while the true underlying percentage is
 * retained and shown, and the status label must be correct. Pure presentational
 * props with a stub onSaveGoal — no hooks/Supabase.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoalProgressCard } from './GoalProgressCard';

describe('GoalProgressCard', () => {
  it('caps the bar at 100% while retaining the true value and status', () => {
    // start 70, goal 75 (gaining goal), current 80 -> progress = 200%.
    render(
      <GoalProgressCard
        goalWeightKg={75}
        goalStartWeightKg={70}
        currentWeightKg={80}
        onSaveGoal={vi.fn()}
      />,
    );

    // Bar is capped at 100%.
    const bar = screen.getByRole('progressbar', { name: /goal progress/i });
    expect(bar).toHaveAttribute('aria-valuenow', '100');

    // True underlying value is retained and surfaced (200.0%).
    expect(screen.getByText(/200\.0% of the way there/)).toBeInTheDocument();
    expect(screen.getByText(/bar capped at 100%/)).toBeInTheDocument();

    // Correct status label.
    expect(screen.getByText(/goal exceeded/i)).toBeInTheDocument();
  });

  it('classifies a not-yet-reached gaining goal without exceeding the bar', () => {
    // start 70, goal 80, current 74 -> 40%.
    render(
      <GoalProgressCard
        goalWeightKg={80}
        goalStartWeightKg={70}
        currentWeightKg={74}
        onSaveGoal={vi.fn()}
      />,
    );
    const bar = screen.getByRole('progressbar', { name: /goal progress/i });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText(/gaining toward your goal/i)).toBeInTheDocument();
  });

  it('prompts to set a goal when none exists', () => {
    render(
      <GoalProgressCard
        goalWeightKg={null}
        goalStartWeightKg={null}
        currentWeightKg={72}
        onSaveGoal={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/set a goal weight to track your progress/i),
    ).toBeInTheDocument();
  });
});
