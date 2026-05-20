import type { Dispatch } from 'react'
import type { ProjectDoc } from '../types'
import type { Action, CoreState } from '../store/editor-store'

/** Script path to sync: active tab, else project main script. */
export function resolveLogicScriptPath(state: CoreState): string | null {
  if (state.activeScriptPath) return state.activeScriptPath
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

  const exists = state.openScripts.some((s) => s.path === path)
  if (exists) {
    dispatch({ type: 'UPDATE_SCRIPT', path, content: lua })
  } else {
    dispatch({
      type: 'OPEN_SCRIPT',
      file: { path, content: lua, isDirty: true },
    })
  }
  return true
}

/** Stable key for logic board document (detect visual edits only). */
export function logicBoardsRevision(project: ProjectDoc | null): string {
  if (!project?.logicBoards) return ''
  return JSON.stringify(project.logicBoards)
}
