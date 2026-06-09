// ---------------------------------------------------------------------------
// Logic Board revision tracking — script buffer vs WASM preview.
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../../types'
import { logicBoardsRevision } from '../sync-logic-board-script'

/** True when compiled logic must be pushed to the preview runtime via Apply. */
export function logicBoardNeedsPreviewApply(
  project: ProjectDoc | null,
  compileOk: boolean,
  previewAppliedRevision: string | null,
): boolean {
  const boardsRevision = logicBoardsRevision(project)
  return (
    Boolean(project) &&
    compileOk &&
    boardsRevision !== '' &&
    previewAppliedRevision !== boardsRevision
  )
}

/** True when main script buffer may be behind the current rules (e.g. user-edited main.lua). */
export function logicBoardScriptOutOfSync(
  project: ProjectDoc | null,
  scriptSyncedRevision: string | null,
): boolean {
  const boardsRevision = logicBoardsRevision(project)
  return boardsRevision !== '' && scriptSyncedRevision !== boardsRevision
}
