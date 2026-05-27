import type { Dispatch } from 'react'
import type { ProjectDoc } from '../types'
import type { Action, CoreState } from '../store/editor-store'
import { makeConsoleEntry } from '../components/menu-bar/makeConsoleEntry'
import { compileLogicBoardSafe } from './logic-board/compile-logic-board-safe'

/**
 * Script path for Logic Board output — always the project entry script.
 * Never the active tab (entity scripts must not receive compiled board Lua).
 */
export function resolveLogicScriptPath(state: CoreState): string | null {
  return state.project?.mainScriptPath ?? null
}

export interface SyncLogicBoardToScriptOptions {
  /** When false, update main script buffer without switching the active tab. */
  activate?: boolean
}

/** Push compiled Logic Board Lua into openScripts (opens tab if needed). */
export function syncLogicBoardToScript(
  dispatch: Dispatch<Action>,
  state: CoreState,
  lua: string,
  options: SyncLogicBoardToScriptOptions = {},
): boolean {
  const path = resolveLogicScriptPath(state)
  if (!path) return false

  const { activate = true } = options
  dispatch({
    type: 'UPSERT_SCRIPT',
    path,
    content: lua,
    isDirty: false,
    activate,
  })
  return true
}

export interface SyncLogicBoardFromProjectOptions extends SyncLogicBoardToScriptOptions {}

/**
 * After LOAD_PROJECT: compile logic boards into mainScriptPath so preview/runtime
 * and resolvePreviewMainLua see fresh Lua (not stale main.lua on disk).
 */
export function syncLogicBoardFromProject(
  dispatch: Dispatch<Action>,
  state: CoreState,
  options: SyncLogicBoardFromProjectOptions = {},
): boolean {
  const project = state.project
  if (!project?.logicBoards?.length || !project.mainScriptPath) return false

  const compiled = compileLogicBoardSafe(project.logicBoards, project)
  if (!compiled.ok) {
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(
        `[Logic Board] Compile failed — main script was not updated:\n${compiled.error}`,
        'error',
      ),
    })
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    return false
  }
  return syncLogicBoardToScript(dispatch, state, compiled.lua, options)
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
