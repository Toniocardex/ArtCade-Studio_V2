import { useState } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import { allClassNames, findObjectTypeForInstance } from '../../utils/project'
import { createLogicBoardForObjectType } from '../../utils/logic-board/factory'

type EditorDispatch = Dispatch<Action>

export type LogicBoardRulesheetActions = Readonly<{
  classes: string[]
  newClass: string
  setNewClass: (className: string) => void
  onCreateRulesheet: (entityId: number) => void
  onOpenRulesheet: (boardId: string) => void
  onGoToCanvas: () => void
  onCreateClassRulesheet: () => void
  onDeleteBoard: () => void
}>

export function useLogicBoardRulesheetActions(params: {
  project: ProjectDoc | null
  boardId: string | null | undefined
  dispatch: EditorDispatch
  setSelectedBoardId: (id: string | null) => void
}): LogicBoardRulesheetActions {
  const { project, boardId, dispatch, setSelectedBoardId } = params
  const [newClass, setNewClass] = useState('')

  const classes = project ? allClassNames(project) : []

  const onCreateRulesheet = (entityId: number) => {
    if (!project) return
    const typeId = findObjectTypeForInstance(project, entityId)
    if (!typeId) {
      console.warn(
        `[LogicBoard] Cannot create board: object #${entityId} has no resolvable object type.`,
      )
      return
    }
    const b = createLogicBoardForObjectType(typeId)
    dispatch({ type: 'LOGIC_ADD_BOARD', board: b })
    setSelectedBoardId(b.boardId)
  }

  const onOpenRulesheet = (boardId: string) => {
    setSelectedBoardId(boardId)
  }

  const onGoToCanvas = () => {
    dispatch({ type: 'SET_MODE', mode: 'canvas' })
  }

  const onCreateClassRulesheet = () => {
    const b = createLogicBoardForObjectType(newClass)
    dispatch({ type: 'LOGIC_ADD_BOARD', board: b })
    setSelectedBoardId(b.boardId)
    setNewClass('')
  }

  const onDeleteBoard = () => {
    if (!boardId) return
    dispatch({ type: 'LOGIC_DELETE_BOARD', boardId })
    setSelectedBoardId(null)
  }

  return {
    classes,
    newClass,
    setNewClass,
    onCreateRulesheet,
    onOpenRulesheet,
    onGoToCanvas,
    onCreateClassRulesheet,
    onDeleteBoard,
  }
}
