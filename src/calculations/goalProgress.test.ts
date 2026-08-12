import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calculateGoalProgress } from './goalProgress';

describe('calculateGoalProgress — unit', () => {
  it('classifies a gaining goal in progress', () => {
    // Bulk: starting 70, goal 80, current 75 -> 50% of the way.
    const r = calculateGoalProgress(70, 75, 80);
    expect(r.progressPercent).toBeCloseTo(50, 10);
    expect(r.displayPercent).toBeCloseTo(50, 10);
    expect(r.status).toBe('gaining');
    expect(r.changeKg).toBeCloseTo(5, 10);
    expect(r.remainingKg).toBeCloseTo(5, 10);
  });

  it('classifies a losing goal in progress', () => {
    // Cut: starting 90, goal 80, current 85 -> 50% of the way.
    const r = calculateGoalProgress(90, 85, 80);
    expect(r.progressPercent).toBeCloseTo(50, 10);
    expect(r.displayPercent).toBeCloseTo(50, 10);
    expect(r.status).toBe('losing');
  });

  it('classifies an exceeded goal and clamps display to 100', () => {
    // Overshoot the gaining goal: progressPercent > 100.
    const r = calculateGoalProgress(70, 85, 80);
    expect(r.progressPercent).toBeGreaterThan(100);
    expect(r.displayPercent).toBe(100);
    expect(r.status).toBe('exceeded');
  });

  it('clamps display to 0 when moving away from the goal (negative percent)', () => {
    // starting 70, goal 80, but current dropped to 65 -> negative progress.
    const r = calculateGoalProgress(70, 65, 80);
    expect(r.progressPercent).toBeLessThan(0);
    expect(r.displayPercent).toBe(0);
    expect(r.status).toBe('gaining');
  });

  it('guards divide-by-zero when starting == goal and current == goal (reached)', () => {
    const r = calculateGoalProgress(80, 80, 80);
    expect(r.progressPercent).toBeNull();
    expect(r.status).toBe('reached');
    expect(r.displayPercent).toBe(100);
  });

  it('guards divide-by-zero when starting == goal and current != goal (undefined)', () => {
    const r = calculateGoalProgress(80, 82, 80);
    expect(r.progressPercent).toBeNull();
    expect(r.status).toBe('undefined');
    expect(r.displayPercent).toBe(0);
  });

  it('does not throw when starting == goal', () => {
    expect(() => calculateGoalProgress(75, 75, 75)).not.toThrow();
    expect(() => calculateGoalProgress(75, 70, 75)).not.toThrow();
  });
});

/**
 * Task 4.6 — Property 12: Goal progress handles gain/loss/reached/exceeded &
 * divide-by-zero.
 * Validates: Requirements 14.3, 14.4, 14.5.
 */
describe('calculateGoalProgress — property', () => {
  const weightArb = fc.double({ min: 30, max: 300, noNaN: true });

  it('Feature: macro-body-composition-calculator, Property 12: Goal progress handles gain/loss/reached/exceeded & divide-by-zero', () => {
    fc.assert(
      fc.property(weightArb, weightArb, weightArb, (starting, current, goal) => {
        const r = calculateGoalProgress(starting, current, goal);

        // displayPercent is always a finite value within [0, 100].
        expect(Number.isFinite(r.displayPercent)).toBe(true);
        expect(r.displayPercent).toBeGreaterThanOrEqual(0);
        expect(r.displayPercent).toBeLessThanOrEqual(100);

        // Divide-by-zero guard: progressPercent is null IFF starting == goal.
        if (starting === goal) {
          expect(r.progressPercent).toBeNull();
          expect(['reached', 'undefined']).toContain(r.status);
          expect(r.displayPercent).toBe(current === goal ? 100 : 0);
        } else {
          const expectedPct =
            ((current - starting) / (goal - starting)) * 100;
          expect(r.progressPercent).toBeCloseTo(expectedPct, 6);
          // displayPercent is the clamp of progressPercent.
          const clamped = Math.min(100, Math.max(0, expectedPct));
          expect(r.displayPercent).toBeCloseTo(clamped, 6);

          // Status classification is consistent with the design pseudocode.
          if ((r.progressPercent as number) >= 100) {
            expect(r.status).toBe('exceeded');
          } else if (goal > starting) {
            expect(r.status).toBe('gaining');
          } else {
            expect(r.status).toBe('losing');
          }
        }

        // Signed change/remaining always exact.
        expect(r.changeKg).toBeCloseTo(current - starting, 6);
        expect(r.remainingKg).toBeCloseTo(goal - current, 6);
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: macro-body-composition-calculator, Property 12: Goal progress handles gain/loss/reached/exceeded & divide-by-zero (starting == goal branch)', () => {
    fc.assert(
      fc.property(weightArb, weightArb, (sg, current) => {
        // Force starting == goal to exercise the divide-by-zero guard.
        const r = calculateGoalProgress(sg, current, sg);
        expect(r.progressPercent).toBeNull();
        if (current === sg) {
          expect(r.status).toBe('reached');
          expect(r.displayPercent).toBe(100);
        } else {
          expect(r.status).toBe('undefined');
          expect(r.displayPercent).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
