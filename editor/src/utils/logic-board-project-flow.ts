import type { Dispatch } from 'react'
import type { ProjectDoc } from '../types'
import type { Action, CoreState } from '../store/editor-store'
import { loadScript, resolveScriptPath } from './api'
import { BLANK_MAIN_LUA } from './project-factory'
import {
  LEGACY_MAIN_LUA_MIGRATION_MESSAGE,
  migrateLegacyGeneratedMainLua,
} from './project-main-script'
import { makeConsoleEntry } from '../components/menu-bar/makeConsoleEntry'

/** Load the real main script if needed, then open its read-only Combined Preview. */
export async function openCombinedMainScript(
  dispatch: Dispatch<Action>,
  getState: () => CoreState,
): Promise<boolean> {
  const state = getState()
  const path = state.project?.mainScriptPath
  if (!path) return false

  if (!state.openScripts.some((script) => script.path === path)) {
    const loaded = state.projectPath
      ? await loadScript(resolveScriptPath(state.projectPath, path))
      : null
    if (getState().openScripts.some((script) => script.path === path)) {
      dispatch({ type: 'SET_ACTIVE_SCRIPT', path })
      dispatch({ type: 'SET_MODE', mode: 'script' })
      dispatch({ type: 'SET_MAIN_SCRIPT_VIEW', view: 'combined' })
      return true
    }
    const migration = migrateLegacyGeneratedMainLua(loaded ?? BLANK_MAIN_LUA)
    dispatch({
      type: 'UPSERT_SCRIPT',
      path,
      content: migration.content,
      isDirty: migration.isDirty,
      activate: false,
    })
    if (migration.migrated) {
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(LEGACY_MAIN_LUA_MIGRATION_MESSAGE, 'info'),
      })
    }
  }

  dispatch({ type: 'SET_ACTIVE_SCRIPT', path })
  dispatch({ type: 'SET_MODE', mode: 'script' })
  dispatch({ type: 'SET_MAIN_SCRIPT_VIEW', view: 'combined' })
  return true
}

export function logicBoardsRevision(project: ProjectDoc | null): string {
  if (!project?.logicBoards) return ''
  return JSON.stringify(project.logicBoards)
}
