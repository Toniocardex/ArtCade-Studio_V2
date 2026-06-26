import type { Action } from '../../store/editor-store-state'
import type { ProjectDoc } from '../../types'

export type EditorDispatch = (action: Action) => void

/** Select entity and switch to full-screen Logic Board (same as legacy inspector button). */
export function openLogicBoardForEntity(dispatch: EditorDispatch, entityId: number): void {
  dispatch({ type: 'SELECT_ENTITY', entityId })
  dispatch({ type: 'SET_MODE', mode: 'logic' })
}

/** Open Logic Board for an object type; selects a scene instance when one exists. */
export function openLogicBoardForObjectType(
  dispatch: EditorDispatch,
  project: ProjectDoc,
  objectTypeId: string,
  sceneId: string,
): void {
  const instanceId = project.scenes?.[sceneId]?.instances?.find(
    (instance) => instance.objectTypeId === objectTypeId,
  )?.id

  if (instanceId != null) {
    dispatch({ type: 'SELECT_ENTITY', entityId: instanceId })
  } else {
    dispatch({ type: 'SELECT_ENTITY', entityId: null })
  }
  dispatch({ type: 'SET_MODE', mode: 'logic' })
}
