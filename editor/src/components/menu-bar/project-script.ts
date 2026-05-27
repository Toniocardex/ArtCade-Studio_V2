import { compileProjectLogic } from '../../utils/logic-board/logic-compile-service'
import { BLANK_MAIN_LUA } from '../../utils/project'
import type { ProjectDoc } from '../../types'

export function mainScriptBodyForProject(
  project: ProjectDoc,
  projectPath?: string | null,
): string {
  if (!project.logicBoards?.length) return BLANK_MAIN_LUA
  return compileProjectLogic(project, { projectKey: projectPath ?? undefined }).lua
}

/** Use when the caller should log or show compile diagnostics. */
export function mainScriptBodyForProjectWithStatus(
  project: ProjectDoc,
  projectPath?: string | null,
): { lua: string; compileError: string | null } {
  if (!project.logicBoards?.length) {
    return { lua: BLANK_MAIN_LUA, compileError: null }
  }
  const result = compileProjectLogic(project, { projectKey: projectPath ?? undefined })
  return { lua: result.lua, compileError: result.compileError }
}
