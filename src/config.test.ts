import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';

/**
 * Trivial smoke test that proves the Vitest harness runs and that the
 * centralized CONFIG carries the design's default values. Substantive
 * calculation/validation tests are added in later tasks.
 */
describe('CONFIG', () => {
  it('exposes the design default multipliers and conversion factors', () => {
    expect(CONFIG.DEFAULT_CALORIE_MULTIPLIER).toBe(16.8);
    expect(CONFIG.DEFAULT_PROTEIN_MULTIPLIER).toBe(1.0);
    expect(CONFIG.DEFAULT_FAT_MULTIPLIER).toBe(0.4);
    expect(CONFIG.LB_PER_KG).toBe(2.20462);
    expect(CONFIG.CM_PER_INCH).toBe(2.54);
  });

  it('exposes rolling-window and auto-update thresholds', () => {
    expect(CONFIG.ROLLING_WINDOW_DAYS).toBe(7);
    expect(CONFIG.AUTO_UPDATE_MIN_MEASUREMENTS).toBe(4);
  });

  it('restricts sign-up to the exact allowed email domains', () => {
    expect(CONFIG.ALLOWED_EMAIL_DOMAINS).toEqual([
      'gmail.com',
      'yahoo.com',
      'outlook.com',
      'hotmail.com',
      'icloud.com',
    ]);
  });
});
