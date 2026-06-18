import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { CoreState } from '../../store/editor-store-state'
import type { EntityDef, ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import {
  findLogicBoardForInstance,
  getEntitiesInScene,
} from '../../utils/project'
import { resolveEffectiveEntitySelection } from './logic-board-selection'

type EditorDispatch = Dispatch<Action>

export type LogicBoardSelection = Readonly<{
  sceneId: string
  sceneEntities: EntityDef[]
  sceneHasObjects: boolean
  selectedBoardId: string | null
  setSelectedBoardId: (id: string | null) => void
  board: LogicBoard | null
  effectiveSelectedEntityId: number | null
  boardForSelection: LogicBoard | undefined
  canCreateForSelection: boolean
  selectEntityForRules: (entityId: number) => void
}>

export function useLogicBoardSelection(params: {
  project: ProjectDoc | null
  selection: CoreState['selection']
  mode: CoreState['mode']
  boards: LogicBoard[]
  dispatch: EditorDispatch
}): LogicBoardSelection {
  const { project, selection, mode, boards, dispatch } = params
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    boards[0]?.boardId ?? null,
  )

  const sceneId = selection.sceneId ?? project?.activeSceneId ?? ''
  const sceneEntities = project ? getEntitiesInScene(project, sceneId) : []
  const sceneHasObjects = sceneEntities.length > 0

  const board =
    boards.find((b) => b.boardId === selectedBoardId) ?? boards[0] ?? null

  const selectedEntityId = selection.entityId
  const { effectiveEntityId: effectiveSelectedEntityId, inScene: selectedInScene } =
    resolveEffectiveEntitySelection(project, sceneId, selectedEntityId)
  const boardForSelection =
    project && effectiveSelectedEntityId != null
      ? findLogicBoardForInstance(project, effectiveSelectedEntityId)
      : undefined

  useEffect(() => {
    if (mode !== 'logic' || !project) return
    if (selectedEntityId != null && sceneId && !selectedInScene) {
      dispatch({ type: 'SELECT_ENTITY', entityId: null })
    }
  }, [mode, project, selectedEntityId, sceneId, selectedInScene, dispatch])

  useEffect(() => {
    if (mode !== 'logic' || !project) return
    const eid = selection.entityId
    if (eid == null) return
    const existing = findLogicBoardForInstance(project, eid)
    if (existing) setSelectedBoardId(existing.boardId)
  }, [mode, selection.entityId, project])

  useEffect(() => {
    if (boards.length === 0) {
      if (selectedBoardId !== null) setSelectedBoardId(null)
      return
    }
    if (!selectedBoardId || !boards.some((b) => b.boardId === selectedBoardId)) {
      setSelectedBoardId(boards[0]!.boardId)
    }
  }, [boards, selectedBoardId])

  const selectEntityForRules = (entityId: number) => {
    dispatch({ type: 'SELECT_ENTITY', entityId })
    const existing = project && findLogicBoardForInstance(project, entityId)
    if (existing) setSelectedBoardId(existing.boardId)
  }

  const canCreateForSelection =
    selectedInScene &&
    effectiveSelectedEntityId != null &&
    boardForSelection == null

  return {
    sceneId,
    sceneEntities,
    sceneHasObjects,
    selectedBoardId,
    setSelectedBoardId,
    board,
    effectiveSelectedEntityId,
    boardForSelection,
    canCreateForSelection,
    selectEntityForRules,
  }
}
