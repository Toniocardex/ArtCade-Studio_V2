// ---------------------------------------------------------------------------
// Central Logic Board compile API — diagnostics, safe emit, last-good Lua cache.
// ---------------------------------------------------------------------------

import type { LogicBoardDoc } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { BLANK_MAIN_LUA } from '../project-factory'
import { compileLogicBoard } from './compiler'
import { findClickToDestroyErrors } from './click-to-destroy'
import { findBoardCompatibilityErrors } from './trigger-compatibility'

export type LogicDiagnosticSeverity = 'error' | 'warn'
export type LogicDiagnosticSource = 'config' | 'compile'

export interface LogicDiagnostic {
  boardId: string
  eventId?: string
  message: string
  severity: LogicDiagnosticSeverity
  source: LogicDiagnosticSource
}

export interface CompileProjectLogicResult {
  ok: boolean
  lua: string
  diagnostics: LogicDiagnostic[]
  /** First compile-time failure message (console / banners). */
  compileError: string | null
}

export interface CompileProjectLogicOptions {
  projectKey?: string
}

const lastGoodLuaByProjectKey = new Map<string, string>()

export function clearLogicCompileCache(projectKey?: string): void {
  if (projectKey === undefined) {
    lastGoodLuaByProjectKey.clear()
    return
  }
  lastGoodLuaByProjectKey.delete(projectKey)
}

function resolveProjectKey(
  project: ProjectDoc | null,
  options?: CompileProjectLogicOptions,
): string {
  return options?.projectKey ?? project?.mainScriptPath ?? ''
}

/** Config warnings for all boards (trigger/target, clickToDestroy placement). */
export function collectConfigDiagnostics(project: ProjectDoc | null): LogicDiagnostic[] {
  const diagnostics: LogicDiagnostic[] = []
  for (const board of project?.logicBoards ?? []) {
    for (const err of findBoardCompatibilityErrors(board)) {
      diagnostics.push({
        boardId: board.boardId,
        eventId: err.eventId,
        message: err.message,
        severity: 'warn',
        source: 'config',
      })
    }
    for (const err of findClickToDestroyErrors(board)) {
      diagnostics.push({
        boardId: board.boardId,
        eventId: err.eventId,
        message: err.message,
        severity: 'warn',
        source: 'config',
      })
    }
  }
  return diagnostics
}

/** Warn diagnostics for a single board (Logic Board panel banner). */
export function configDiagnosticsForBoard(
  diagnostics: LogicDiagnostic[],
  boardId: string,
): LogicDiagnostic[] {
  return diagnostics.filter(
    (d) => d.source === 'config' && d.severity === 'warn' && d.boardId === boardId,
  )
}

export function formatConfigDiagnosticsSummary(diagnostics: LogicDiagnostic[]): string | null {
  const lines = diagnostics.map((d) => d.message)
  return lines.length > 0 ? lines.join('\n') : null
}

export function compileProjectLogic(
  project: ProjectDoc | null,
  options?: CompileProjectLogicOptions,
): CompileProjectLogicResult {
  const configDiagnostics = collectConfigDiagnostics(project)
  const boards = project?.logicBoards ?? []
  const cacheKey = resolveProjectKey(project, options)

  if (boards.length === 0) {
    return {
      ok: true,
      lua: BLANK_MAIN_LUA,
      diagnostics: configDiagnostics,
      compileError: null,
    }
  }

  try {
    const lua = compileLogicBoard(boards, project)
    lastGoodLuaByProjectKey.set(cacheKey, lua)
    return {
      ok: true,
      lua,
      diagnostics: configDiagnostics,
      compileError: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const compileDiagnostic: LogicDiagnostic = {
      boardId: '',
      message,
      severity: 'error',
      source: 'compile',
    }
    const cached = lastGoodLuaByProjectKey.get(cacheKey)
    return {
      ok: false,
      lua: cached ?? BLANK_MAIN_LUA,
      diagnostics: [...configDiagnostics, compileDiagnostic],
      compileError: message,
    }
  }
}

export function compileProjectLogicLua(
  project: ProjectDoc | null,
  options?: CompileProjectLogicOptions,
): string {
  return compileProjectLogic(project, options).lua
}

/** Compile a board doc slice with optional full project context (tests, previews). */
export function compileLogicBoardDoc(
  doc: LogicBoardDoc,
  project?: ProjectDoc | null,
  options?: CompileProjectLogicOptions,
): CompileProjectLogicResult {
  const merged: ProjectDoc = {
    ...(project ?? ({} as ProjectDoc)),
    logicBoards: doc,
  }
  return compileProjectLogic(merged, options)
}
