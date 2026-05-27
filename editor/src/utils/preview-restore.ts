import type { Dispatch } from 'react'
import { compileLogicBoardLuaOrBlank } from './logic-board/compile-logic-board-safe'
import { BLANK_MAIN_LUA } from './project'
import type { Action } from '../store/editor-store'
import type { ConsoleEntry, ProjectDoc, ScriptFile } from '../types'

export interface PreviewRestoreInput {
  project: ProjectDoc
  openScripts: ScriptFile[]
}

/** Resolve the main Lua source to push after a preview STOP / Logic Board Apply. */
export function resolvePreviewMainLua(input: PreviewRestoreInput): string {
  const { project, openScripts } = input
  const path = project.mainScriptPath
  if (path) {
    const tab = openScripts.find(s => s.path === path)
    if (tab?.content) return tab.content
  }
  const boards = project.logicBoards ?? []
  if (boards.length > 0) return compileLogicBoardLuaOrBlank(boards, project).lua
  return BLANK_MAIN_LUA
}

/** Same as resolvePreviewMainLua but surfaces compile failure for logging. */
export function resolvePreviewMainLuaWithStatus(
  input: PreviewRestoreInput,
): { lua: string; compileError: string | null } {
  const { project, openScripts } = input
  const path = project.mainScriptPath
  if (path) {
    const tab = openScripts.find((s) => s.path === path)
    if (tab?.content) return { lua: tab.content, compileError: null }
  }
  const boards = project.logicBoards ?? []
  if (boards.length > 0) {
    const { lua, error } = compileLogicBoardLuaOrBlank(boards, project)
    return { lua, compileError: error }
  }
  return { lua: BLANK_MAIN_LUA, compileError: null }
}

/** Log compile failure and open the console (Play, project sync, Apply). */
export function logLogicBoardCompileFailure(
  dispatch: Dispatch<Action>,
  compileError: string | null,
  makeEntry: (message: string, level: ConsoleEntry['level']) => ConsoleEntry,
  prefix = '[Preview]',
): void {
  if (!compileError) return
  dispatch({
    type: 'LOG',
    entry: makeEntry(
      `${prefix} Logic Board compile failed — using blank or open script tab:\n${compileError}`,
      'error',
    ),
  })
  dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
}
