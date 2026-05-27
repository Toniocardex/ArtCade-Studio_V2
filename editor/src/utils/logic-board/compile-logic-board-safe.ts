// ---------------------------------------------------------------------------
// Safe wrapper around compileLogicBoard — never throws; for React useMemo/UI.
// ---------------------------------------------------------------------------

import type { LogicBoardDoc } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { BLANK_MAIN_LUA } from '../project-factory'
import { compileLogicBoard } from './compiler'

export type CompileLogicBoardResult =
  | { ok: true; lua: string }
  | { ok: false; error: string }

export function compileLogicBoardSafe(
  doc: LogicBoardDoc,
  project?: ProjectDoc | null,
): CompileLogicBoardResult {
  try {
    return { ok: true, lua: compileLogicBoard(doc, project) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/** Never throws; returns blank main.lua when compile fails (preview / save paths). */
export function compileLogicBoardLuaOrBlank(
  doc: LogicBoardDoc,
  project?: ProjectDoc | null,
): { lua: string; error: string | null } {
  const result = compileLogicBoardSafe(doc, project)
  if (result.ok) return { lua: result.lua, error: null }
  return { lua: BLANK_MAIN_LUA, error: result.error }
}
