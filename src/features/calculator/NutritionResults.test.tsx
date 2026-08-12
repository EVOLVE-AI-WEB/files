/**
 * Tests for the Calculator's Nutrition Results (Task 14.1; R6.4, R19).
 *
 * Verifies display rounding is applied at render and that a carb shortfall
 * surfaces the guidance message (never a negative carb value).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MacroResult } from '../../types';
import { NutritionResults } from './NutritionResults';

const HEALTHY: MacroResult = {
  totalCalories: 2592.63312,
  proteinGrams: 154.3234,
  fatGrams: 61.72936,
  carbGrams: 354.94382,
  proteinCalories: 617.2936,
  fatCalories: 555.56424,
  remainingCalories: 1419.77528,
  isCarbShortfall: false,
};

const SHORTFALL: MacroResult = {
  totalCalories: 1000,
  proteinGrams: 300,
  fatGrams: 100,
  carbGrams: 0,
  proteinCalories: 1200,
  fatCalories: 900,
  remainingCalories: -1100,
  isCarbShortfall: true,
  guidanceMessage:
    'Protein and fat targets exceed total calories. ' +
    'Increase the calorie multiplier or reduce protein/fat multipliers.',
};

describe('NutritionResults', () => {
  it('renders the 70 kg reference vector with display rounding', () => {
    render(<NutritionResults macros={HEALTHY} />);
    // 2592.63312 -> "2,593"; 154.3234 -> "154"; 61.72936 -> "62"; 354.94382 -> "355".
    expect(screen.getByText('2,593')).toBeInTheDocument();
    expect(screen.getByText('154')).toBeInTheDocument();
    expect(screen.getByText('62')).toBeInTheDocument();
    expect(screen.getByText('355')).toBeInTheDocument();
  });

  it('shows carb-shortfall guidance and never a negative carb value', () => {
    render(<NutritionResults macros={SHORTFALL} />);
    expect(
      screen.getByText(/protein and fat targets exceed total calories/i),
    ).toBeInTheDocument();
    // Carbs pinned to 0 g (not negative).
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
