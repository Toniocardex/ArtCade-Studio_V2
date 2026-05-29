import type { Action } from '../../store/editor-store-state'

export type EditorDispatch = (action: Action) => void

/** Select entity and switch to full-screen Logic Board (same as legacy inspector button). */
export function openLogicBoardForEntity(dispatch: EditorDispatch, entityId: number): void {
  dispatch({ type: 'SELECT_ENTITY', entityId })
  dispatch({ type: 'SET_MODE', mode: 'logic' })
}
