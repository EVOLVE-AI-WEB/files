/**
 * Tests for AutoMacroUpdateControls (Task 15.2; R12.6, R12.9).
 *
 * Disabling Auto Macro Update must present the two explicit choices — return to
 * baseline, or make the current weight the new baseline — and the latter must
 * require an extra confirmation. The qualification status reason must also be
 * surfaced. Presentational props with stub callbacks — no hooks/Supabase.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AutoUpdateQualification } from '../../types';
import { AutoMacroUpdateControls } from './AutoMacroUpdateControls';

const QUALIFIES: AutoUpdateQualification = {
  qualifies: true,
  rollingAverageKg: 71.2,
  measurementCount: 5,
  minimumRequired: 4,
  reason: 'Qualifying 7-day average available',
};

const NOT_ENOUGH: AutoUpdateQualification = {
  qualifies: false,
  rollingAverageKg: 71.2,
  measurementCount: 2,
  minimumRequired: 4,
  reason: 'Need at least 4 measurements in the last 7 days',
};

describe('AutoMacroUpdateControls', () => {
  it('offers the two explicit choices when disabling', async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    const onMakeBaseline = vi.fn();

    render(
      <AutoMacroUpdateControls
        enabled
        qualification={QUALIFIES}
        activeWeightKg={71.2}
        baselineWeightKg={70}
        onEnable={vi.fn()}
        onDisableReturnToBaseline={onReturn}
        onDisableMakeCurrentBaseline={onMakeBaseline}
      />,
    );

    // Toggle off (the switch).
    await user.click(screen.getByRole('switch', { name: /auto macro update/i }));

    // Both explicit choices are presented.
    const returnBtn = screen.getByRole('button', {
      name: /return to my baseline weight of 70\.0 kg/i,
    });
    const makeBaselineBtn = screen.getByRole('button', {
      name: /make my current weight \(71\.2 kg\) my new baseline/i,
    });
    expect(returnBtn).toBeInTheDocument();
    expect(makeBaselineBtn).toBeInTheDocument();

    // Making current weight the baseline requires a confirmation step.
    await user.click(makeBaselineBtn);
    expect(onMakeBaseline).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', {
        name: /confirm: set 71\.2 kg as my new baseline/i,
      }),
    );
    expect(onMakeBaseline).toHaveBeenCalledTimes(1);
  });

  it('returns to baseline in a single confirmed click', async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    render(
      <AutoMacroUpdateControls
        enabled
        qualification={QUALIFIES}
        activeWeightKg={71.2}
        baselineWeightKg={70}
        onEnable={vi.fn()}
        onDisableReturnToBaseline={onReturn}
        onDisableMakeCurrentBaseline={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('switch', { name: /auto macro update/i }));
    await user.click(
      screen.getByRole('button', {
        name: /return to my baseline weight of 70\.0 kg/i,
      }),
    );
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('surfaces the qualification reason when not enough measurements', () => {
    render(
      <AutoMacroUpdateControls
        enabled
        qualification={NOT_ENOUGH}
        activeWeightKg={71.2}
        baselineWeightKg={70}
        onEnable={vi.fn()}
        onDisableReturnToBaseline={vi.fn()}
        onDisableMakeCurrentBaseline={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        /Macro targets were not updated because only 2 weight measurements were recorded/i,
      ),
    ).toBeInTheDocument();
  });
});
