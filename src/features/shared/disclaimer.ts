/**
 * Shared disclaimer + configurable-multiplier copy (R24.1–24.3).
 *
 * The exact disclaimer text is lifted verbatim from design.md (UI / Design
 * System → Disclaimer). It is surfaced in the Calculator's Methodology section
 * (and available to any other screen that needs it). The 16.8 kcal/lb calorie
 * multiplier is always presented as a *configurable default*, never a medically
 * exact figure (R24.3).
 */
import { CONFIG } from '../../config';

/** Verbatim estimates/limitations disclaimer (design.md). */
export const DISCLAIMER_TEXT =
  'These calculations provide estimates for informational and personal ' +
  'planning purposes. BMI and circumference-based body-fat methods have ' +
  'limitations and are not medical diagnoses. Individual calorie needs can ' +
  'vary based on activity, metabolism, training, and other factors.';

/**
 * Copy framing the default calorie multiplier as configurable, not exact.
 * Reads the value from CONFIG so the text and the default never drift apart.
 */
export const CALORIE_MULTIPLIER_NOTE =
  `The ${CONFIG.DEFAULT_CALORIE_MULTIPLIER} kcal/lb calorie multiplier is a ` +
  'configurable default, not a medically exact figure — adjust it in Advanced ' +
  'Macro Settings to suit your needs.';
