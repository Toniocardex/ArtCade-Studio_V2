import { useMemo, useState } from 'react'
import { useEditorDispatch, useEditorSelector, useEditorStore } from '../../store/editor-store'
import { logicBoardsForScene } from '../../utils/project'
import { useRuntimeReady } from '../../utils/runtime-sync-service'
import type { LogicBoardPanelState } from './logic-board-panel-state'
import { useLogicBoardCompile } from './useLogicBoardCompile'
import { useLogicBoardEventClipboard } from './useLogicBoardEventClipboard'
import { useLogicBoardRulesheetActions } from './useLogicBoardRulesheetActions'
import { useLogicBoardSelection } from './useLogicBoardSelection'

export type { LogicBoardPanelState } from './logic-board-panel-state'

export function useLogicBoardPanelState(): LogicBoardPanelState {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const project = useEditorSelector((s) => s.project)
  const selectionState = useEditorSelector((s) => s.selection)
  const mode = useEditorSelector((s) => s.mode)
  const authoringMode = useEditorSelector((s) => s.authoringMode)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const logicPreviewAppliedRevision = useEditorSelector((s) => s.logicPreviewAppliedRevision)
  const runtimeReady = useRuntimeReady()
  const [panelMode, setPanelMode] = useState<'visual' | 'lua'>('visual')

  const boards = project?.logicBoards ?? []

  const selection = useLogicBoardSelection({
    project,
    selection: selectionState,
    mode,
    boards,
    dispatch,
  })

  const compile = useLogicBoardCompile({
    project,
    projectPath,
    board: selection.board,
    boards,
    runtimeReady,
    mode,
    logicPreviewAppliedRevision,
    selectedBoardId: selection.selectedBoardId,
    selectionSceneId: selectionState.sceneId,
    dispatch,
    getState: store.getState,
  })

  const sceneBoards = useMemo(
    () => (project ? logicBoardsForScene(project, selection.sceneId) : []),
    [project, selection.sceneId, compile.boardsRevision],
  )

  const events = useLogicBoardEventClipboard({
    project,
    board: selection.board,
    sceneBoards,
    mode,
    panelMode,
    boardsRevision: compile.boardsRevision,
    dispatch,
    getState: store.getState,
  })

  const rulesheet = useLogicBoardRulesheetActions({
    project,
    boardId: selection.board?.boardId,
    dispatch,
    setSelectedBoardId: selection.setSelectedBoardId,
  })

  return {
    project,
    panelMode,
    setPanelMode,
    boards,
    dispatch,
    selection,
    compile,
    events,
    rulesheet,
    authoringMode,
  }
}
