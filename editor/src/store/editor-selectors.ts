// ---------------------------------------------------------------------------
// editor-selectors — stable useEditorSelector helpers
// ---------------------------------------------------------------------------
//
// Selectors passed to useSyncExternalStore must return referentially stable
// values when the underlying store slice is unchanged. Never use inline `?? []`
// fallbacks — each getSnapshot call would allocate a new array and React 19
// will recurse until "Maximum update depth exceeded".

import type { CoreState } from './editor-store-state'
import type { GameVariableDefinition } from '../types'

const EMPTY_GLOBAL_VARIABLES: GameVariableDefinition[] = []

/**
 * Project-wide variable definitions. Returns a shared empty array when unset.
 */
export function selectGlobalVariables(state: CoreState): GameVariableDefinition[] {
  return state.project?.globalVariables ?? EMPTY_GLOBAL_VARIABLES
}
