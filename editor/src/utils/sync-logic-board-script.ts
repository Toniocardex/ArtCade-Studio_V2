import type { Dispatch } from 'react'
import type { ProjectDoc } from '../types'
import type { Action, CoreState } from '../store/editor-store'

/**
 * Script path for Logic Board output — always the project entry script.
 * Never the active tab (entity scripts must not receive compiled board Lua).
 */
export function resolveLogicScriptPath(state: CoreState): string | null {
  return state.project?.mainScriptPath ?? null
}

/** Push compiled Logic Board Lua into openScripts (opens tab if needed). */
export function syncLogicBoardToScript(
  dispatch: Dispatch<Action>,
  state: CoreState,
  lua: string,
): boolean {
  const path = resolveLogicScriptPath(state)
  if (!path) return false

  dispatch({
    type: 'UPSERT_SCRIPT',
    path,
    content: lua,
    isDirty: false,
    activate: true,
  })
  return true
}

/** Sync compiled board Lua into main, then switch to full Editor Script on that tab. */
export function openMainScriptInEditor(
  dispatch: Dispatch<Action>,
  state: CoreState,
  lua: string,
): boolean {
  if (!resolveLogicScriptPath(state) || !syncLogicBoardToScript(dispatch, state, lua)) {
    return false
  }
  dispatch({ type: 'SET_MODE', mode: 'script' })
  return true
}

/** Stable key for logic board document (detect visual edits only). */
export function logicBoardsRevision(project: ProjectDoc | null): string {
  if (!project?.logicBoards) return ''
  return JSON.stringify(project.logicBoards)
}
