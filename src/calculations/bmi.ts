/**
 * BMI calculation and categorization (design.md, Part II — BMI Calculation).
 *
 * Pure and side-effect-free. BMI is always framed as a screening measure, never
 * a medical diagnosis. For users under age 20 the adult screening bands do not
 * apply; a BMI-for-age percentile note is returned instead. No rounding is
 * applied here — rounding is display-only.
 *
 * _Requirements: 7.1, 7.2, 7.3, 7.4_
 */
import type { BMICategory } from '../types';

/** bmi = weightKg / (heightCm/100)^2. No rounding. */
export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Classify BMI using adult screening bands (age >= 20). Under age 20 the adult
 * categories do not apply and a percentile note is returned.
 */
export function getBMICategory(bmi: number, age: number): BMICategory {
  if (age < 20) {
    return {
      label: 'See BMI-for-age percentile',
      appliesAdultCategories: false,
      note: 'Adult categories do not apply under age 20',
    };
  }

  let label: BMICategory['label'];
  if (bmi < 18.5) {
    label = 'Underweight';
  } else if (bmi < 25.0) {
    label = 'Healthy';
  } else if (bmi < 30.0) {
    label = 'Overweight';
  } else if (bmi < 35.0) {
    label = 'Obesity Class I';
  } else if (bmi < 40.0) {
    label = 'Obesity Class II';
  } else {
    label = 'Obesity Class III';
  }

  return { label, appliesAdultCategories: true };
}
