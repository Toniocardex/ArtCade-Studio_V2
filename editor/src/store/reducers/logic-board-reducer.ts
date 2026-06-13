// ---------------------------------------------------------------------------
// reducers/logic-board-reducer — CRUD on project.logicBoards
// ---------------------------------------------------------------------------
//
// Boards live inside ProjectDoc so each mutation must mark the project
// dirty. `withBoards` keeps the immutable plumbing in one place; the rest
// of the file is one switch case per action.

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { LogicBoard } from '../../types'
import { logicBoardDefaultName } from '../../utils/logic-board/labels'
function withBoards(
  state: CoreState,
  fn: (boards: LogicBoard[]) => LogicBoard[],
): CoreState {
  if (!state.project) return state
  const boards = state.project.logicBoards ?? []
  const next = fn(boards)
  if (next === boards) return state
  return {
    ...state,
    project: { ...state.project, logicBoards: next },
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
                name: action.name.trim() || logicBoardDefaultName(board),
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
    case 'LOGIC_UNDO':
    case 'LOGIC_REDO':
      return state
    case 'LOGIC_MARK_PREVIEW_APPLIED':
      return { ...state, logicPreviewAppliedRevision: action.revision }
    default:
      return state
  }
}
