// ---------------------------------------------------------------------------
// Safe wrapper around compileLogicBoard — never throws; for React useMemo/UI.
// Delegates to logic-compile-service.
// ---------------------------------------------------------------------------

import type { LogicBoardDoc } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import {
  compileLogicBoardDoc,
  type CompileProjectLogicResult,
} from './logic-compile-service'

export type CompileLogicBoardResult =
  | { ok: true; lua: string }
  | { ok: false; error: string }

export function compileLogicBoardSafe(
  doc: LogicBoardDoc,
  project?: ProjectDoc | null,
  options?: { projectKey?: string },
): CompileLogicBoardResult {
  const result = compileLogicBoardDoc(doc, project, options)
  if (result.ok) return { ok: true, lua: result.lua }
  return { ok: false, error: result.compileError ?? 'Logic Board compile failed' }
}

/** Never throws; returns blank or last-good main.lua when compile fails. */
export function compileLogicBoardLuaOrBlank(
  doc: LogicBoardDoc,
  project?: ProjectDoc | null,
  options?: { projectKey?: string },
): { lua: string; error: string | null } {
  const result = compileLogicBoardDoc(doc, project, options)
  return { lua: result.lua, error: result.compileError }
}

export type { CompileProjectLogicResult }
