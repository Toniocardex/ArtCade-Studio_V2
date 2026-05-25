import { compileLogicBoard } from '../../utils/logic-board/compiler'
import { BLANK_MAIN_LUA } from '../../utils/project'
import type { ProjectDoc } from '../../types'

export function mainScriptBodyForProject(project: ProjectDoc): string {
  return project.logicBoards?.length
    ? compileLogicBoard(project.logicBoards, project)
    : BLANK_MAIN_LUA
}
