import type { Dispatch } from 'react'
import { compileProjectLogic } from './logic-board/logic-compile-service'
import { BLANK_MAIN_LUA } from './project'
import { runtimeProjectFingerprint } from './runtime-fingerprint'
import type { Action } from '../store/editor-store'
import type { ConsoleEntry, ProjectDoc, ScriptFile } from '../types'

export interface PreviewRestoreInput {
  project: ProjectDoc
  openScripts: ScriptFile[]
  projectPath?: string | null
}

function mainScriptTab(
  input: PreviewRestoreInput,
): ScriptFile | undefined {
  const path = input.project.mainScriptPath
  if (!path) return undefined
  return input.openScripts.find((s) => s.path === path)
}

/**
 * Resolve the main Lua pushed on PLAY / STOP / preview sync.
 * Logic Board output wins over the on-disk main.lua stub unless the user is
 * actively editing that script tab (isDirty).
 */
export function resolvePreviewMainLua(input: PreviewRestoreInput): string {
  return resolvePreviewMainLuaWithStatus(input).lua
}

/**
 * Stable key for preview Lua recompile — excludes unrelated open script tabs.
 */
export function getPreviewLuaSyncKey(input: PreviewRestoreInput): string {
  const tab = mainScriptTab(input)
  return JSON.stringify({
    projectFp: runtimeProjectFingerprint(input.project, input.project.activeSceneId),
    projectPath: input.projectPath ?? '',
    mainDirty: Boolean(tab?.isDirty),
    mainContent: tab?.isDirty ? tab.content : '',
  })
}

/** Same as resolvePreviewMainLua but surfaces compile failure for logging. */
export function resolvePreviewMainLuaWithStatus(
  input: PreviewRestoreInput,
): { lua: string; compileError: string | null } {
  const { project, projectPath } = input
  const tab = mainScriptTab(input)
  const boards = project.logicBoards ?? []

  if (boards.length > 0) {
    if (tab?.isDirty && tab.content) {
      return { lua: tab.content, compileError: null }
    }
    const result = compileProjectLogic(project, { projectKey: projectPath ?? undefined })
    return { lua: result.lua, compileError: result.compileError }
  }

  if (tab?.content) return { lua: tab.content, compileError: null }
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
