/**
 * State-layer barrel (Task 10). The five-concept separation lives here: the
 * pure Active_Weight_Selector, the derived macro-state selector, and the
 * append-only macro-target-history helpers. None of these mutate a source of
 * truth; the macro formulas receive only the selected active weight.
 */
export {
  selectActiveWeight,
  type ActiveWeightSelectorInput,
  type ActiveWeightSelection,
  type ActiveWeightSource,
} from './activeWeightSelector';

export {
  deriveMacroState,
  type DeriveMacroStateInput,
  type MacroState,
} from './macroState';

export {
  isEffectiveTargetChange,
  sourceForTrigger,
  resolveMacroTargetSource,
  buildMacroTargetHistoryInsert,
  type EffectiveTargetSnapshot,
  type MacroChangeTrigger,
  type BuildMacroTargetHistoryParams,
} from './macroTargetHistory';
