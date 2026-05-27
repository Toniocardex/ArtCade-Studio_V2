import { compileLogicBoardLuaOrBlank } from '../../utils/logic-board/compile-logic-board-safe'
import { BLANK_MAIN_LUA } from '../../utils/project'
import type { ProjectDoc } from '../../types'

export function mainScriptBodyForProject(project: ProjectDoc): string {
  if (!project.logicBoards?.length) return BLANK_MAIN_LUA
  return compileLogicBoardLuaOrBlank(project.logicBoards, project).lua
}

/** Use when the caller should log or show compile diagnostics. */
export function mainScriptBodyForProjectWithStatus(
  project: ProjectDoc,
): { lua: string; compileError: string | null } {
  if (!project.logicBoards?.length) {
    return { lua: BLANK_MAIN_LUA, compileError: null }
  }
  const { lua, error } = compileLogicBoardLuaOrBlank(project.logicBoards, project)
  return { lua, compileError: error }
}
