// ---------------------------------------------------------------------------
// Logic Board panel — visual event-list editor.
//
// Entity-first: rulesheets bind to entityId by default; class boards in Advanced.
// Script tab: per-board read-only Lua slice and Combined Preview navigation.
//
// All mutations go through LOGIC_*; main.lua remains user-owned.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorDispatch, useEditorSelector, useEditorStore } from '../store/editor-store'
import {
  allClassNames,
  findLogicBoardForInstance,
  findObjectTypeForInstance,
  getEntitiesInScene,
  logicBoardsForScene,
} from '../utils/project'
import {
  compileProjectLogic,
  configDiagnosticsForBoard,
  formatConfigDiagnosticsSummary,
} from '../utils/logic-board/logic-compile-service'
import { LogicBoardCompileErrorBanner } from '../components/LogicBoardCompileErrorBanner'
import { useRuntimeReady } from '../utils/runtime-sync-service'
import { createLogicBoardForObjectType } from '../utils/logic-board/factory'
import { cloneLogicEvent } from '../utils/logic-board/clone'
import { eventCompatibilityError } from '../utils/logic-board/trigger-compatibility'
import {
  focusIdAfterDelete,
  scrollLogicEventRowIntoViewSoon,
} from '../utils/logic-board/logic-event-list-ui'
import {
  findEventInBoards,
  handleLogicBoardKey,
} from '../utils/logic-board/logic-board-keyboard'
import { executeApplyLogic } from '../utils/logic-board/apply-logic'
import { useLogicAutoApply } from './logic-board/useLogicAutoApply'
import type { LogicSyncStatus } from '../utils/logic-board/auto-apply-status'
import type { LogicBoard, LogicEvent } from '../types/logic-board'
import type { ProjectDoc } from '../types'
import { LogicBoardLuaPreview } from './logic-board/LogicBoardLuaPreview'
import { LogicBoardHeader } from './logic-board/LogicBoardHeader'
import { LogicBoardVisualLayout } from './logic-board/LogicBoardVisualLayout'
import {
  logicBoardsRevision,
  openCombinedMainScript,
} from '../utils/logic-board-project-flow'
import { extractBoardLuaSlice } from '../utils/logic-board/extract-board-lua-slice'
import {
  logicBoardCompilerLabel,
  logicBoardLuaCommentLabel,
} from '../utils/logic-board/labels'
import type { Action } from '../store/editor-store'
import type { Dispatch } from 'react'

type EditorDispatch = Dispatch<Action>

type LogicClipboard = { kind: 'event'; event: LogicEvent } | null

type LogicBoardLuaModeProps = Readonly<{
  project: ProjectDoc
  boards: LogicBoard[]
  board: LogicBoard | null
  lua: string
  compileError: string | null
  boardConfigWarning: string | null
  compileResult: ReturnType<typeof compileProjectLogic>
  showFullMain: boolean
  setShowFullMain: (v: boolean | ((prev: boolean) => boolean)) => void
  applyMsg: string | null
  syncStatus: LogicSyncStatus
  setPanelMode: (mode: 'visual' | 'lua') => void
  setSelectedBoardId: (id: string | null) => void
  dispatch: EditorDispatch
  onApply: () => void
  onRetrySync: () => void
}>

function LogicBoardLuaMode({
  project,
  boards,
  board,
  lua,
  compileError,
  boardConfigWarning,
  compileResult,
  showFullMain,
  setShowFullMain,
  applyMsg,
  syncStatus,
  setPanelMode,
  setSelectedBoardId,
  dispatch,
  onApply,
  onRetrySync,
}: LogicBoardLuaModeProps) {
  const store = useEditorStore()
  const mainPath = project.mainScriptPath
  const boardLabel = board ? logicBoardLuaCommentLabel(board) : ''
  const slice = extractBoardLuaSlice(lua, boardLabel)
  const displayLua = showFullMain ? lua : slice.text
  const previewTitle = board
    ? `Generated · ${logicBoardCompilerLabel(board)}`
    : 'Generated script'
  const previewSubtitle = showFullMain
    ? `Full ${mainPath}`
    : `Section of ${mainPath}`
  const openMainTooltip =
    `Opens the read-only Combined Preview for ${mainPath}. ` +
    'My Script remains editable and is never regenerated.'

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[var(--bg)]">
      <LogicBoardHeader
        mode="lua"
        setMode={setPanelMode}
        boards={boards}
        board={board}
        onSelectBoard={setSelectedBoardId}
        onRenameBoard={(boardId, name) =>
          dispatch({ type: 'LOGIC_RENAME_BOARD', boardId, name })
        }
        onApply={onApply}
        onRetrySync={onRetrySync}
        applyMsg={applyMsg}
        syncStatus={syncStatus}
        project={project}
      />
      {compileError && <LogicBoardCompileErrorBanner error={compileError} />}
      {!compileError && boardConfigWarning && (
        <LogicBoardCompileErrorBanner
          title="Rulesheet configuration issue"
          error={boardConfigWarning}
          hint="Fix these rules before Apply or Play will use stale or blank logic."
        />
      )}
      <LogicBoardLuaPreview
        lua={displayLua}
        title={previewTitle}
        subtitle={previewSubtitle}
        emptyMessage={
          !showFullMain && slice.sectionCount === 0
            ? 'No Lua for this board yet. Add or enable events in Rules.'
            : undefined
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => setShowFullMain((v) => !v)}
            className="px-3 py-2 rounded text-xs text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border-2)] hover:bg-[var(--panel-3)]"
          >
            {showFullMain ? 'Show this board only' : 'Show full main'}
          </button>
        }
        action={
          <button
            type="button"
            title={openMainTooltip}
            disabled={!!compileError}
            onClick={() => {
              if (compileResult.ok) {
                void openCombinedMainScript(dispatch, store.getState)
              }
            }}
            className="px-4 py-2 rounded text-xs font-semibold border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open Combined Preview →
          </button>
        }
      />
    </div>
  )
}

export default function LogicBoardPanel() {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const project = useEditorSelector((s) => s.project)
  const selection = useEditorSelector((s) => s.selection)
  const mode = useEditorSelector((s) => s.mode)
  const authoringMode = useEditorSelector((s) => s.authoringMode)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const logicPreviewAppliedRevision = useEditorSelector((s) => s.logicPreviewAppliedRevision)
  const runtimeReady = useRuntimeReady()
  const boards = project?.logicBoards ?? []
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    boards[0]?.boardId ?? null,
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'visual' | 'lua'>('visual')
  const [showFullMain, setShowFullMain] = useState(false)
  const [newClass, setNewClass] = useState('')
  const [applyMsg, setApplyMsg] = useState<string | null>(null)
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null)
  const [clipboardHint, setClipboardHint] = useState<string | null>(null)
  const clipboardRef = useRef<LogicClipboard>(null)
  const hintTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
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
    if (hintTimerRef.current != null) globalThis.clearTimeout(hintTimerRef.current)
  }, [])

  const showClipboardHint = useCallback((msg: string) => {
    setClipboardHint(msg)
    if (hintTimerRef.current != null) globalThis.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = globalThis.setTimeout(() => setClipboardHint(null), 2000)
  }, [])

  const sceneId = selection.sceneId ?? project?.activeSceneId ?? ''
  const sceneEntities = project ? getEntitiesInScene(project, sceneId) : []

  const board =
    boards.find((b) => b.boardId === selectedBoardId) ?? boards[0] ?? null

  const selectedEntityId = selection.entityId
  const boardForSelection =
    project && selectedEntityId != null
      ? findLogicBoardForInstance(project, selectedEntityId)
      : undefined

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
  const sceneBoards = useMemo(
    () => (project ? logicBoardsForScene(project, sceneId) : []),
    [project, sceneId, boardsRevision],
  )

  const handleApply = useCallback(() => {
    if (!project) return
    const ok = executeApplyLogic({
      compileResult,
      runtimeReady,
      state: store.getState(),
      project,
      selectionSceneId: selection.sceneId ?? undefined,
      dispatch,
      flashApplyMsg,
    })
    if (ok) {
      dispatch({ type: 'LOGIC_MARK_PREVIEW_APPLIED', revision: boardsRevision })
    }
  }, [
    compileResult,
    runtimeReady,
    store,
    project,
    selection.sceneId,
    dispatch,
    flashApplyMsg,
    boardsRevision,
  ])

  const classes = project ? allClassNames(project) : []

  const selectEntityForRules = (entityId: number) => {
    dispatch({ type: 'SELECT_ENTITY', entityId })
    const existing = project && findLogicBoardForInstance(project, entityId)
    if (existing) setSelectedBoardId(existing.boardId)
  }

  const createBoardForEntity = (entityId: number) => {
    if (!project) return
    const existing = findLogicBoardForInstance(project, entityId)
    if (existing) {
      setSelectedBoardId(existing.boardId)
      return
    }
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

  const insertClonedEvent = useCallback(
    (
      source: LogicEvent,
      targetBoard: LogicBoard,
      afterEventId?: string,
      options?: { openEditor?: boolean },
    ) => {
      const copy = cloneLogicEvent(source)
      dispatch({
        type: 'LOGIC_INSERT_EVENT',
        boardId: targetBoard.boardId,
        event: copy,
        afterEventId,
      })
      setFocusedEventId(copy.id)
      if (options?.openEditor) setEditingId(copy.id)
      scrollLogicEventRowIntoViewSoon(copy.id)
      return copy
    },
    [dispatch],
  )

  const cloneEvent = useCallback(
    (ev: LogicEvent, eventBoard?: LogicBoard) => {
      const target = eventBoard ?? board
      if (!target) return
      insertClonedEvent(ev, target, ev.id)
    },
    [board, insertClonedEvent],
  )

  const copyEvent = useCallback(
    (ev: LogicEvent) => {
      clipboardRef.current = { kind: 'event', event: structuredClone(ev) }
      showClipboardHint('Rule copied')
    },
    [showClipboardHint],
  )

  const pasteEvent = useCallback(
    (afterEventId?: string) => {
      const clip = clipboardRef.current
      if (clip?.kind !== 'event') return
      const pasteBoard =
        findEventInBoards(sceneBoards, focusedEventId)?.board ?? board
      if (!pasteBoard) return
      const compat = eventCompatibilityError(clip.event, pasteBoard.target.type)
      if (compat) {
        showClipboardHint(compat)
        return
      }
      insertClonedEvent(
        clip.event,
        pasteBoard,
        afterEventId ?? focusedEventId ?? undefined,
      )
      showClipboardHint('Rule pasted into this rulesheet')
    },
    [board, sceneBoards, focusedEventId, insertClonedEvent, showClipboardHint],
  )

  const moveFocusedEvent = useCallback(
    (toIndex: number) => {
      const hit = findEventInBoards(sceneBoards, focusedEventId)
      if (!hit || focusedEventId == null) return
      dispatch({
        type: 'LOGIC_MOVE_EVENT',
        boardId: hit.board.boardId,
        eventId: focusedEventId,
        toIndex,
      })
      scrollLogicEventRowIntoViewSoon(focusedEventId)
    },
    [sceneBoards, focusedEventId, dispatch],
  )

  useEffect(() => {
    if (!project) return
    // Check against the live store, not the render-captured sceneBoards: when
    // LOGIC_ADD_EVENT and setFocusedEventId land in the same handler, this
    // effect can run on an intermediate commit whose memoized sceneBoards
    // predate the new event — clearing the focus that was just set.
    const liveBoards = store.getState().project?.logicBoards ?? []
    if (editingId != null && !findEventInBoards(liveBoards, editingId)) {
      setEditingId(null)
    }
    if (focusedEventId != null && !findEventInBoards(liveBoards, focusedEventId)) {
      setFocusedEventId(null)
    }
  }, [boardsRevision, project, editingId, focusedEventId, store])

  const deleteFocusedEvent = useCallback(() => {
    const hit = findEventInBoards(sceneBoards, focusedEventId)
    if (!hit) return
    const { board: eventBoard, event } = hit
    const nextFocus = focusIdAfterDelete(eventBoard.events, event.id)
    dispatch({
      type: 'LOGIC_DELETE_EVENT',
      boardId: eventBoard.boardId,
      eventId: event.id,
    })
    if (editingId === event.id) setEditingId(null)
    setFocusedEventId(nextFocus)
    if (nextFocus) scrollLogicEventRowIntoViewSoon(nextFocus)
  }, [sceneBoards, focusedEventId, editingId, dispatch])

  useEffect(() => {
    if (mode !== 'logic' || panelMode !== 'visual') return
    if (sceneBoards.length === 0 && !board) return

    const onKeyDown = (e: KeyboardEvent) => {
      handleLogicBoardKey(e, {
        sceneBoards,
        activeBoard: board,
        focusedEventId,
        editingId,
        clipboard: clipboardRef.current,
        copyEvent,
        pasteEvent,
        cloneEvent,
        openFocusedForEdit: () => {
          if (focusedEventId == null) return
          setEditingId(focusedEventId)
        },
        closeEditor: () => {
          setEditingId(null)
          scrollLogicEventRowIntoViewSoon(focusedEventId)
        },
        focusEvent: (eventId) => {
          setFocusedEventId(eventId)
          scrollLogicEventRowIntoViewSoon(eventId)
        },
        deleteFocusedEvent,
        moveFocusedEvent,
      })
    }

    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [
    mode,
    panelMode,
    board,
    sceneBoards,
    focusedEventId,
    editingId,
    copyEvent,
    pasteEvent,
    cloneEvent,
    deleteFocusedEvent,
    moveFocusedEvent,
  ])

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">
        Open a project to edit Logic Boards.
      </div>
    )
  }

  if (panelMode === 'lua') {
    return (
      <LogicBoardLuaMode
        project={project}
        boards={boards}
        board={board}
        lua={lua}
        compileError={compileError}
        boardConfigWarning={boardConfigWarning}
        compileResult={compileResult}
        showFullMain={showFullMain}
        setShowFullMain={setShowFullMain}
        applyMsg={applyMsg}
        syncStatus={syncStatus}
        setPanelMode={setPanelMode}
        setSelectedBoardId={setSelectedBoardId}
        dispatch={dispatch}
        onApply={handleApply}
        onRetrySync={retrySync}
      />
    )
  }

  const canCreateForSelection =
    selectedEntityId != null && boardForSelection == null

  const patchFocusedEvent = (event: LogicEvent) => {
    if (!board) return
    dispatch({
      type: 'LOGIC_UPDATE_EVENT',
      boardId: board.boardId,
      event,
    })
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[var(--bg)]"
      data-panel="logic-board"
    >
      <LogicBoardHeader
        mode={panelMode}
        setMode={setPanelMode}
        boards={boards}
        board={board}
        onSelectBoard={setSelectedBoardId}
        onRenameBoard={(boardId, name) =>
          dispatch({ type: 'LOGIC_RENAME_BOARD', boardId, name })
        }
        onApply={handleApply}
        onRetrySync={retrySync}
        applyMsg={applyMsg}
        syncStatus={syncStatus}
        project={project}
      />

      {compileError && <LogicBoardCompileErrorBanner error={compileError} />}
      {!compileError && boardConfigWarning && (
        <LogicBoardCompileErrorBanner
          title="Rulesheet configuration issue"
          error={boardConfigWarning}
          hint="Fix these rules before Apply or Play will use stale or blank logic."
        />
      )}

      {authoringMode === 'base' && (
        <p className="flex-shrink-0 px-4 py-1.5 text-[10px] leading-snug text-[var(--muted)] border-b border-[var(--border)] bg-[var(--panel-2)]">
          <strong className="text-[var(--text)] font-medium">Base view</strong> — guided
          rules with the full toolset (Canvas, Logic, Script). Use{' '}
          <strong>When</strong> for keys (including OR). Turn on{' '}
          <strong>If</strong> only for extra filters. Switch to{' '}
          <strong>Advanced</strong> in the View menu for a denser layout.
        </p>
      )}

      {clipboardHint ? (
        <p className="shrink-0 px-3 py-1 text-[10px] text-[var(--muted)] border-b border-[var(--outline)]">
          {clipboardHint}
        </p>
      ) : null}

      <LogicBoardVisualLayout
        project={project}
        sceneId={sceneId}
        board={board}
        focusedEventId={focusedEventId}
        setFocusedEventId={(id) => {
          setFocusedEventId(id)
          setEditingId(id)
        }}
        sceneEntities={sceneEntities}
        selectedEntityId={selectedEntityId}
        boardForSelection={boardForSelection}
        canCreateForSelection={canCreateForSelection}
        classes={classes}
        newClass={newClass}
        setNewClass={setNewClass}
        onSelectEntity={selectEntityForRules}
        onCreateForEntity={createBoardForEntity}
        onCreateClassRulesheet={() => {
          const b = createLogicBoardForObjectType(newClass)
          dispatch({ type: 'LOGIC_ADD_BOARD', board: b })
          setSelectedBoardId(b.boardId)
          setNewClass('')
        }}
        onDeleteBoard={() => {
          if (!board) return
          dispatch({ type: 'LOGIC_DELETE_BOARD', boardId: board.boardId })
          setSelectedBoardId(null)
        }}
        dispatch={dispatch}
        onPatchEvent={patchFocusedEvent}
        onCloneEvent={cloneEvent}
        onDeleteEvent={(ev, eventBoard) => {
          const nextFocus = focusIdAfterDelete(eventBoard.events, ev.id)
          dispatch({
            type: 'LOGIC_DELETE_EVENT',
            boardId: eventBoard.boardId,
            eventId: ev.id,
          })
          if (editingId === ev.id) setEditingId(null)
          setFocusedEventId(nextFocus)
          if (nextFocus) scrollLogicEventRowIntoViewSoon(nextFocus)
        }}
        onMoveEvent={(eventBoard, eventId, toIndex) => {
          dispatch({
            type: 'LOGIC_MOVE_EVENT',
            boardId: eventBoard.boardId,
            eventId,
            toIndex,
          })
          scrollLogicEventRowIntoViewSoon(eventId)
        }}
      />
    </div>
  )
}
