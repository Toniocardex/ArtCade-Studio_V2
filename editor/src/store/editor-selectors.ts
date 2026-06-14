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

export type VariablePickerOption = { value: string; label: string }

/**
 * Project-wide variable definitions. Returns a shared empty array when unset.
 */
export function selectGlobalVariables(state: CoreState): GameVariableDefinition[] {
  return state.project?.globalVariables ?? EMPTY_GLOBAL_VARIABLES
}

/** Compare Logic Board variable dropdown options by value/label, not reference. */
export function variablePickerOptionsEqual(
  a: readonly VariablePickerOption[],
  b: readonly VariablePickerOption[],
): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].value !== b[i].value || a[i].label !== b[i].label) return false
  }
  return true
}

export function buildVariablePickerOptions(
  definitions: readonly GameVariableDefinition[],
): VariablePickerOption[] {
  return [...new Map(definitions.map((definition) => [definition.key, definition])).values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((definition) => ({ value: definition.key, label: definition.key }))
}
