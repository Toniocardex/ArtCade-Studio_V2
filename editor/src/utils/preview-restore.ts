import { compileLogicBoard } from './logic-board/compiler'
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
  if (boards.length > 0) return compileLogicBoard(boards, project)
  return BLANK_MAIN_LUA
}
