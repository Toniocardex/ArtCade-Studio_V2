import type { Dispatch } from 'react'
import { getProjectWorkbenchSnapshot } from './project-health'
import type { Action } from '../store/editor-store'
import type { ConsoleEntry, ProjectDoc, ScriptFile } from '../types'

export type { PreviewLuaSyncInput } from './preview-lua-sync'
export { getPreviewLuaSyncKey } from './preview-lua-sync'

export interface PreviewRestoreInput {
  project: ProjectDoc
  openScripts: ScriptFile[]
  projectPath?: string | null
}

/**
 * Resolve the main Lua pushed on PLAY / STOP / preview sync.
 * Logic Board output wins over the on-disk main.lua stub unless the user is
 * actively editing that script tab (isDirty).
 */
export function resolvePreviewMainLua(input: PreviewRestoreInput): string {
  return resolvePreviewMainLuaWithStatus(input).lua
}

/** Same as resolvePreviewMainLua but surfaces compile failure for logging. */
export function resolvePreviewMainLuaWithStatus(
  input: PreviewRestoreInput,
): { lua: string; compileError: string | null } {
  return getProjectWorkbenchSnapshot({
    project: input.project,
    projectPath: input.projectPath,
    openScripts: input.openScripts,
    includeCompile: true,
  }).previewLua
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
