import { compileProjectLogic } from '../../utils/logic-board/logic-compile-service'
import { BLANK_MAIN_LUA } from '../../utils/project'
import type { ProjectDoc } from '../../types'
import { composeProjectLua } from '../../utils/project-lua-composer'

/** Use when the caller should log or show compile diagnostics. */
export function mainScriptBodyForProjectWithStatus(
  project: ProjectDoc,
  projectPath?: string | null,
  manualLua = BLANK_MAIN_LUA,
): { lua: string; compileError: string | null } {
  if (!project.logicBoards?.length) {
    return {
      lua: composeProjectLua({ manualLua, projectKey: projectPath }).combinedLua,
      compileError: null,
    }
  }
  const result = compileProjectLogic(project, { projectKey: projectPath ?? undefined })
  return {
    lua: composeProjectLua({
      manualLua,
      generatedLua: result.lua,
      projectKey: projectPath,
    }).combinedLua,
    compileError: result.compileError,
  }
}
