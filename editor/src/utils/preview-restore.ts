import { compileLogicBoardLuaOrBlank } from './logic-board/compile-logic-board-safe'
import { BLANK_MAIN_LUA } from './project'
import type { ProjectDoc, ScriptFile } from '../types'

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
