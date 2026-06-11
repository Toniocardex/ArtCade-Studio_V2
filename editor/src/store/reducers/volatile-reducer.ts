import type { VolatileState, Action } from '../editor-store-state'

export function volatileReducer(state: VolatileState, action: Action): VolatileState {
  switch (action.type) {
    case 'LOG': {
      // Guard against duplicate ids. React StrictMode double-invokes reducers
      // with the same action object, which would append the same entry twice
      // and break React list keys in ConsolePanel.
      if (state.consoleLogs.some((e) => e.id === action.entry.id)) return state
      return { ...state, consoleLogs: [...state.consoleLogs, action.entry] }
    }
    case 'SET_CURSOR':
      if (state.cursorPos.x === action.x && state.cursorPos.y === action.y) return state
      return { ...state, cursorPos: { x: action.x, y: action.y } }
    default:
      return state
  }
}
