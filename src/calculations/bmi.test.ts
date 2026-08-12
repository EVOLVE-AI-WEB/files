import { describe, expect, it } from 'vitest';
import { calculateBMI, getBMICategory } from './bmi';

/**
 * Task 3.2 — Unit tests for BMI bands and the under-20 branch.
 * _Requirements: 7.2, 7.3_
 */
describe('calculateBMI', () => {
  it('computes weightKg / (heightCm/100)^2 without rounding', () => {
    // 70 kg at 175 cm -> 70 / 1.75^2 = 22.857142...
    expect(calculateBMI(70, 175)).toBeCloseTo(22.857142857, 8);
    // Exact case: 100 kg at 200 cm -> 100 / 4 = 25.
    expect(calculateBMI(100, 200)).toBe(25);
  });
});

describe('getBMICategory (adult bands, age >= 20)', () => {
  const adultAge = 30;

  it('classifies each adult band and its boundaries', () => {
    // Underweight (< 18.5)
    expect(getBMICategory(18.4, adultAge).label).toBe('Underweight');
    // Healthy [18.5, 25.0)
    expect(getBMICategory(18.5, adultAge).label).toBe('Healthy');
    expect(getBMICategory(24.9, adultAge).label).toBe('Healthy');
    // Overweight [25.0, 30.0)
    expect(getBMICategory(25.0, adultAge).label).toBe('Overweight');
    expect(getBMICategory(29.9, adultAge).label).toBe('Overweight');
    // Obesity Class I [30.0, 35.0)
    expect(getBMICategory(30.0, adultAge).label).toBe('Obesity Class I');
    expect(getBMICategory(34.9, adultAge).label).toBe('Obesity Class I');
    // Obesity Class II [35.0, 40.0)
    expect(getBMICategory(35.0, adultAge).label).toBe('Obesity Class II');
    expect(getBMICategory(39.9, adultAge).label).toBe('Obesity Class II');
    // Obesity Class III (>= 40.0)
    expect(getBMICategory(40.0, adultAge).label).toBe('Obesity Class III');
    expect(getBMICategory(55, adultAge).label).toBe('Obesity Class III');
  });

  it('marks adult categories as applicable', () => {
    expect(getBMICategory(22, adultAge).appliesAdultCategories).toBe(true);
  });
});

describe('getBMICategory (under age 20)', () => {
  it('returns the BMI-for-age percentile note and does not apply adult bands', () => {
    const result = getBMICategory(22, 19);
    expect(result.label).toBe('See BMI-for-age percentile');
    expect(result.appliesAdultCategories).toBe(false);
    expect(result.note).toBeDefined();
  });

  it('ignores BMI value entirely for under-20 users', () => {
    // Even a very high BMI yields the percentile note, not an adult obesity band.
    expect(getBMICategory(45, 12).label).toBe('See BMI-for-age percentile');
  });
});
