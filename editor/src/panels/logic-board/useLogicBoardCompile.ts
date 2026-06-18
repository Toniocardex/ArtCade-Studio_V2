import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { CoreState } from '../../store/editor-store-state'
import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import {
  compileProjectLogic,
  configDiagnosticsForBoard,
  formatConfigDiagnosticsSummary,
} from '../../utils/logic-board/logic-compile-service'
import { executeApplyLogic } from '../../utils/logic-board/apply-logic'
import type { LogicSyncStatus } from '../../utils/logic-board/auto-apply-status'
import { logicBoardsRevision } from '../../utils/logic-board-project-flow'
import { useLogicAutoApply } from './useLogicAutoApply'

type EditorDispatch = Dispatch<Action>

export type LogicBoardCompile = Readonly<{
  compileResult: ReturnType<typeof compileProjectLogic>
  lua: string
  compileError: string | null
  boardConfigWarning: string | null
  syncStatus: LogicSyncStatus
  retrySync: () => void
  handleApply: () => void
  applyMsg: string | null
  showFullMain: boolean
  setShowFullMain: (v: boolean | ((prev: boolean) => boolean)) => void
  boardsRevision: string
}>

export function useLogicBoardCompile(params: {
  project: ProjectDoc | null
  projectPath: string | null
  board: LogicBoard | null
  boards: LogicBoard[]
  runtimeReady: boolean
  mode: CoreState['mode']
  logicPreviewAppliedRevision: string | null
  selectedBoardId: string | null
  selectionSceneId: string | null | undefined
  dispatch: EditorDispatch
  getState: () => CoreState
}): LogicBoardCompile {
  const {
    project,
    projectPath,
    board,
    boards,
    runtimeReady,
    mode,
    logicPreviewAppliedRevision,
    selectedBoardId,
    selectionSceneId,
    dispatch,
    getState,
  } = params

  const [showFullMain, setShowFullMain] = useState(false)
  const [applyMsg, setApplyMsg] = useState<string | null>(null)
  const applyMsgTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)

  const flashApplyMsg = useCallback((msg: string, ms = 4000) => {
    if (applyMsgTimerRef.current != null) globalThis.clearTimeout(applyMsgTimerRef.current)
    setApplyMsg(msg)
    applyMsgTimerRef.current = globalThis.setTimeout(() => {
      applyMsgTimerRef.current = null
      setApplyMsg(null)
    }, ms)
  }, [])

  useEffect(() => () => {
    if (applyMsgTimerRef.current != null) globalThis.clearTimeout(applyMsgTimerRef.current)
  }, [])

  const compileResult = useMemo(
    () => compileProjectLogic(project, { projectKey: projectPath ?? undefined }),
    [boards, project, projectPath],
  )
  const lua = compileResult.lua
  const compileError = compileResult.compileError

  const boardConfigWarning = useMemo(() => {
    if (!board) return null
    const warns = configDiagnosticsForBoard(compileResult.diagnostics, board.boardId)
    return formatConfigDiagnosticsSummary(warns)
  }, [board, compileResult.diagnostics])

  useEffect(() => {
    setShowFullMain(false)
  }, [selectedBoardId])

  const boardsRevision = logicBoardsRevision(project)

  useEffect(() => {
    if (mode !== 'logic' || !boardsRevision) return
    if (logicPreviewAppliedRevision != null) return
    dispatch({ type: 'LOGIC_MARK_PREVIEW_APPLIED', revision: boardsRevision })
  }, [mode, logicPreviewAppliedRevision, boardsRevision, dispatch])

  const { status: syncStatus, retrySync } = useLogicAutoApply({
    compileResult,
    runtimeReady,
    boardsRevision,
    hasBoards: boards.length > 0,
  })

  const handleApply = useCallback(() => {
    if (!project) return
    const ok = executeApplyLogic({
      compileResult,
      runtimeReady,
      state: getState(),
      project,
      selectionSceneId: selectionSceneId ?? undefined,
      dispatch,
      flashApplyMsg,
    })
    if (ok) {
      dispatch({ type: 'LOGIC_MARK_PREVIEW_APPLIED', revision: boardsRevision })
    }
  }, [
    compileResult,
    runtimeReady,
    getState,
    project,
    selectionSceneId,
    dispatch,
    flashApplyMsg,
    boardsRevision,
  ])

  return {
    compileResult,
    lua,
    compileError,
    boardConfigWarning,
    syncStatus,
    retrySync,
    handleApply,
    applyMsg,
    showFullMain,
    setShowFullMain,
    boardsRevision,
  }
}
