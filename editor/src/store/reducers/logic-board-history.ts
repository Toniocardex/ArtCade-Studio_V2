// ---------------------------------------------------------------------------
// Logic Board undo/redo snapshot stack (logicBoards only).
// Snapshots use structuredClone (deep copy); skip push when revision unchanged.
// ---------------------------------------------------------------------------

import type { CoreState, LogicBoardHistory } from '../editor-store-state'
import type { LogicBoard } from '../../types'
import { logicBoardsRevision } from '../../utils/sync-logic-board-script'

export const MAX_LOGIC_BOARD_HISTORY = 50

export const emptyLogicBoardHistory = (): LogicBoardHistory => ({
  past: [],
  future: [],
})

export function pushLogicBoardHistory(state: CoreState): CoreState {
  if (!state.project?.logicBoards) return state
  const hist = state.logicBoardHistory ?? emptyLogicBoardHistory()
  const currentRev = logicBoardsRevision(state.project)
  const last = hist.past[hist.past.length - 1]
  if (
    last &&
    logicBoardsRevision({ ...state.project, logicBoards: last }) === currentRev
  ) {
    return state
  }
  const snap = structuredClone(state.project.logicBoards)
  const past = [...hist.past, snap].slice(-MAX_LOGIC_BOARD_HISTORY)
  return {
    ...state,
    logicBoardHistory: { past, future: [] },
  }
}

export function restoreLogicBoards(
  state: CoreState,
  boards: LogicBoard[],
  history: LogicBoardHistory,
): CoreState {
  if (!state.project) return state
  return {
    ...state,
    project: { ...state.project, logicBoards: boards },
    projectDirty: true,
    logicBoardHistory: history,
  }
}
