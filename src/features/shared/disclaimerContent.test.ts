/**
 * Tests for the disclaimer constants module (Bug 2 fix; R24.1–24.3).
 *
 * Confirms DISCLAIMER_TEXT and CALORIE_MULTIPLIER_NOTE resolve reliably from
 * the distinctly-named `disclaimerContent` module (which no longer collides by
 * filename case with the `Disclaimer.tsx` component), that the disclaimer text
 * is verbatim per design.md, and that the multiplier note reflects
 * CONFIG.DEFAULT_CALORIE_MULTIPLIER so the copy never drifts from the value.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../config';
import { DISCLAIMER_TEXT, CALORIE_MULTIPLIER_NOTE } from './disclaimerContent';

const VERBATIM_DESIGN_TEXT =
  'These calculations provide estimates for informational and personal ' +
  'planning purposes. BMI and circumference-based body-fat methods have ' +
  'limitations and are not medical diagnoses. Individual calorie needs can ' +
  'vary based on activity, metabolism, training, and other factors.';

describe('disclaimerContent constants', () => {
  it('resolves both exports (no missing exports)', () => {
    expect(typeof DISCLAIMER_TEXT).toBe('string');
    expect(typeof CALORIE_MULTIPLIER_NOTE).toBe('string');
    expect(DISCLAIMER_TEXT.length).toBeGreaterThan(0);
    expect(CALORIE_MULTIPLIER_NOTE.length).toBeGreaterThan(0);
  });

  it('keeps DISCLAIMER_TEXT verbatim per design.md (R24)', () => {
    expect(DISCLAIMER_TEXT).toBe(VERBATIM_DESIGN_TEXT);
  });

  it('derives CALORIE_MULTIPLIER_NOTE from CONFIG.DEFAULT_CALORIE_MULTIPLIER', () => {
    expect(CALORIE_MULTIPLIER_NOTE).toContain(
      String(CONFIG.DEFAULT_CALORIE_MULTIPLIER),
    );
    expect(CALORIE_MULTIPLIER_NOTE).toMatch(/configurable default/i);
  });
});
