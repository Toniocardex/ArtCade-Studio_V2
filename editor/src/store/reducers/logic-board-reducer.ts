// ---------------------------------------------------------------------------
// reducers/logic-board-reducer — CRUD on project.logicBoards
// ---------------------------------------------------------------------------
//
// Boards live inside ProjectDoc so each mutation must mark the project
// dirty. `withBoards` keeps the immutable plumbing in one place; the rest
// of the file is one switch case per action.

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { LogicBoard } from '../../types'
import { logicBoardGeneratedLabel } from '../../utils/logic-board/labels'
import {
  MAX_LOGIC_BOARD_HISTORY,
  emptyLogicBoardHistory,
  pushLogicBoardHistory,
  restoreLogicBoards,
} from './logic-board-history'

function withBoards(
  state: CoreState,
  fn: (boards: LogicBoard[]) => LogicBoard[],
  recordHistory = true,
): CoreState {
  if (!state.project) return state
  const boards = state.project.logicBoards ?? []
  const next = fn(boards)
  if (next === boards) return state
  const base = recordHistory ? pushLogicBoardHistory(state) : state
  return {
    ...base,
    project: { ...base.project!, logicBoards: next },
    projectDirty: true,
  }
}

export const logicBoardReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'LOGIC_ADD_BOARD':
      return withBoards(state, (b) =>
        b.some((x) => x.boardId === action.board.boardId)
          ? b
          : [...b, action.board],
      )
    case 'LOGIC_RENAME_BOARD':
      return withBoards(state, (b) =>
        b.map((board) =>
          board.boardId === action.boardId
            ? {
                ...board,
                name: action.name.trim() || logicBoardGeneratedLabel(board.boardId),
              }
            : board,
        ),
      )
    case 'LOGIC_DELETE_BOARD':
      return withBoards(state, (b) =>
        b.filter((x) => x.boardId !== action.boardId),
      )
    case 'LOGIC_ADD_EVENT':
      return withBoards(state, (b) =>
        b.map((board) =>
          board.boardId === action.boardId
            ? { ...board, events: [...board.events, action.event] }
            : board,
        ),
      )
    case 'LOGIC_INSERT_EVENT': {
      const { boardId, event, afterEventId } = action
      return withBoards(state, (b) =>
        b.map((board) => {
          if (board.boardId !== boardId) return board
          if (!afterEventId) {
            return { ...board, events: [...board.events, event] }
          }
          const idx = board.events.findIndex((e) => e.id === afterEventId)
          if (idx < 0) {
            return { ...board, events: [...board.events, event] }
          }
          const events = board.events.slice()
          events.splice(idx + 1, 0, event)
          return { ...board, events }
        }),
      )
    }
    case 'LOGIC_UPDATE_EVENT':
      return withBoards(state, (b) =>
        b.map((board) =>
          board.boardId === action.boardId
            ? {
                ...board,
                events: board.events.map((e) =>
                  e.id === action.event.id ? action.event : e,
                ),
              }
            : board,
        ),
      )
    case 'LOGIC_DELETE_EVENT':
      return withBoards(state, (b) =>
        b.map((board) =>
          board.boardId === action.boardId
            ? {
                ...board,
                events: board.events.filter((e) => e.id !== action.eventId),
              }
            : board,
        ),
      )
    case 'LOGIC_MOVE_EVENT': {
      const { boardId, eventId, toIndex } = action
      return withBoards(state, (b) =>
        b.map((board) => {
          if (board.boardId !== boardId) return board
          const from = board.events.findIndex((e) => e.id === eventId)
          if (from < 0) return board
          const clamped = Math.max(0, Math.min(toIndex, board.events.length - 1))
          if (from === clamped) return board
          const events = board.events.slice()
          const [item] = events.splice(from, 1)
          events.splice(clamped, 0, item!)
          return { ...board, events }
        }),
      )
    }
    case 'LOGIC_UNDO': {
      const { past, future } = state.logicBoardHistory ?? emptyLogicBoardHistory()
      if (!state.project || past.length === 0) return state
      const previous = past[past.length - 1]!
      const current = structuredClone(state.project.logicBoards ?? [])
      return restoreLogicBoards(state, previous, {
        past: past.slice(0, -1),
        future: [current, ...future].slice(0, MAX_LOGIC_BOARD_HISTORY),
      })
    }
    case 'LOGIC_REDO': {
      const { past, future } = state.logicBoardHistory ?? emptyLogicBoardHistory()
      if (!state.project || future.length === 0) return state
      const next = future[0]!
      const current = structuredClone(state.project.logicBoards ?? [])
      return restoreLogicBoards(state, next, {
        past: [...past, current].slice(-MAX_LOGIC_BOARD_HISTORY),
        future: future.slice(1),
      })
    }
    case 'LOGIC_MARK_SCRIPT_SYNCED':
      return { ...state, logicScriptSyncedRevision: action.revision }
    case 'LOGIC_MARK_PREVIEW_APPLIED':
      return { ...state, logicPreviewAppliedRevision: action.revision }
    default:
      return state
  }
}
