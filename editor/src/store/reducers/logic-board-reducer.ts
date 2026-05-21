// ---------------------------------------------------------------------------
// reducers/logic-board-reducer — CRUD on project.logicBoards
// ---------------------------------------------------------------------------
//
// Boards live inside ProjectDoc so each mutation must mark the project
// dirty. `withBoards` keeps the immutable plumbing in one place; the rest
// of the file is one switch case per action.

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { LogicBoard } from '../../types'

function withBoards(
  state: CoreState,
  fn: (boards: LogicBoard[]) => LogicBoard[],
): CoreState {
  if (!state.project) return state
  const next = fn(state.project.logicBoards ?? [])
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
    default:
      return state
  }
}
