// ---------------------------------------------------------------------------
// Logic Board panel — visual event-list editor.
//
// Entity-first: rulesheets bind to entityId by default; class boards in Advanced.
// Script tab: per-board read-only Lua slice, optional full main, Open main.lua.
//
// All mutations go through LOGIC_*; compiled Lua syncs to mainScriptPath in store.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../store/editor-store'
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
import { editorReloadScript } from '../utils/wasm-bridge'
import { runtimeSync, useRuntimeReady } from '../utils/runtime-sync-service'
import {
  createLogicBoardForEntity,
  createLogicBoardForObjectType,
} from '../utils/logic-board/factory'
import { cloneLogicEvent } from '../utils/logic-board/clone'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'
import type { LogicBoard, LogicEvent, LogicTriggerType } from '../types/logic-board'
import type { ProjectDoc } from '../types'
import { LogicBoardLuaPreview } from './logic-board/LogicBoardLuaPreview'
import { LogicBoardHeader } from './logic-board/LogicBoardHeader'
import { LogicBoardEventsList } from './logic-board/LogicBoardEventsList'
import { RulesheetControls } from './logic-board/RulesheetControls'
import {
  logicBoardsRevision,
  openMainScriptInEditor,
  syncLogicBoardToScript,
} from '../utils/sync-logic-board-script'
import { extractBoardLuaSlice } from '../utils/logic-board/extract-board-lua-slice'
import {
  logicBoardCompilerLabel,
  logicBoardLuaCommentLabel,
} from '../utils/logic-board/labels'
import type { Action, CoreState } from '../store/editor-store'
import type { Dispatch } from 'react'

type EditorDispatch = Dispatch<Action>

type LogicClipboard = { kind: 'event'; event: LogicEvent } | null

function hasNonEmptyTextSelection(): boolean {
  const sel = globalThis.getSelection?.()
  return Boolean(sel && sel.toString().length > 0)
}

function findEventInBoards(
  boards: LogicBoard[],
  eventId: string | null,
): { board: LogicBoard; event: LogicEvent } | undefined {
  if (eventId == null) return undefined
  for (const board of boards) {
    const event = board.events.find((ev) => ev.id === eventId)
    if (event) return { board, event }
  }
  return undefined
}

type LogicClipboardKeyHandlers = {
  sceneBoards: LogicBoard[]
  activeBoard: LogicBoard | null
  focusedEventId: string | null
  clipboard: LogicClipboard
  copyEvent: (ev: LogicEvent) => void
  pasteEvent: (afterEventId?: string) => void
  cloneEvent: (ev: LogicEvent, board?: LogicBoard) => void
}

function handleLogicBoardClipboardKey(
  e: KeyboardEvent,
  handlers: LogicClipboardKeyHandlers,
): void {
  const {
    sceneBoards,
    activeBoard,
    focusedEventId,
    clipboard,
    copyEvent,
    pasteEvent,
    cloneEvent,
  } = handlers
  if (shouldIgnoreEditorShortcut(e)) return
  if (!e.ctrlKey && !e.metaKey) return

  const focused = findEventInBoards(sceneBoards, focusedEventId)?.event
  const key = e.key.toLowerCase()

  if (key === 'c') {
    if (!focused || hasNonEmptyTextSelection()) return
    e.preventDefault()
    copyEvent(focused)
    return
  }
  if (key === 'v') {
    if (clipboard?.kind !== 'event' || !activeBoard) return
    e.preventDefault()
    pasteEvent(focused?.id)
    return
  }
  if (key === 'd') {
    if (!focused) return
    e.preventDefault()
    const hit = findEventInBoards(sceneBoards, focusedEventId)
    cloneEvent(focused, hit?.board ?? activeBoard ?? undefined)
  }
}

type ApplyLogicParams = Readonly<{
  compileResult: ReturnType<typeof compileProjectLogic>
  runtimeReady: boolean
  state: CoreState
  project: ProjectDoc
  selectionSceneId: string | undefined
  dispatch: EditorDispatch
  flashApplyMsg: (msg: string, ms?: number) => void
}>

function executeApplyLogic({
  compileResult,
  runtimeReady,
  state,
  project,
  selectionSceneId,
  dispatch,
  flashApplyMsg,
}: ApplyLogicParams): void {
  if (!compileResult.ok) {
    flashApplyMsg('Fix Logic Board compile errors before applying.', 5000)
    return
  }
  syncLogicBoardToScript(dispatch, state, compileResult.lua)
  if (!runtimeReady) {
    flashApplyMsg('Runtime still loading — try again in a moment.')
    return
  }
  if (state.isPlaying) {
    dispatch({ type: 'SET_PLAYING', playing: false })
    const activeSceneId = selectionSceneId ?? project.activeSceneId
    const ok = runtimeSync.restorePreviewFromProject(
      project, activeSceneId, compileResult.lua, state.dialogs,
    )
    if (!ok) {
      flashApplyMsg('Runtime call failed — see the console for details.')
      return
    }
    flashApplyMsg('Logic applied — preview reset to design state')
    return
  }
  runtimeSync.syncDialogs(state.dialogs)
  const ok = editorReloadScript(compileResult.lua)
  flashApplyMsg(
    ok
      ? 'Logic applied — script hot-reloaded (press PLAY to test)'
      : 'Runtime call failed — see the console for details.',
  )
}

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
  setPanelMode: (mode: 'visual' | 'lua') => void
  setSelectedBoardId: (id: string | null) => void
  dispatch: EditorDispatch
  state: CoreState
  onApply: () => void
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
  setPanelMode,
  setSelectedBoardId,
  dispatch,
  state,
  onApply,
}: LogicBoardLuaModeProps) {
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
    `Opens ${mainPath} in the Script Editor with Logic-Board–compiled Lua (all boards). ` +
    'Open other .lua files from the entity Inspector.'

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]">
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
        applyMsg={applyMsg}
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
              if (compileResult.ok) openMainScriptInEditor(dispatch, state, compileResult.lua)
            }}
            className="px-4 py-2 rounded text-xs font-semibold border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open main.lua →
          </button>
        }
      />
    </div>
  )
}

export default function LogicBoardPanel() {
  const { state, dispatch } = useEditor()
  const project = state.project
  const { selection } = state
  const runtimeReady = useRuntimeReady()

  const authoringMode = state.authoringMode
  const boards = project?.logicBoards ?? []
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    boards[0]?.boardId ?? null,
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'visual' | 'lua'>('visual')
  const [showFullMain, setShowFullMain] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [newClass, setNewClass] = useState('')
  const [newTrigger, setNewTrigger] = useState<LogicTriggerType>('onSpawn')
  const [applyMsg, setApplyMsg] = useState<string | null>(null)
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null)
  const [clipboardHint, setClipboardHint] = useState<string | null>(null)
  const clipboardRef = useRef<LogicClipboard>(null)
  const hintTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)

  const flashApplyMsg = useCallback((msg: string, ms = 4000) => {
    setApplyMsg(msg)
    globalThis.setTimeout(() => setApplyMsg(null), ms)
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
    if (state.mode !== 'logic' || !project) return
    const eid = selection.entityId
    if (eid == null) return
    const existing = findLogicBoardForInstance(project, eid)
    if (existing) setSelectedBoardId(existing.boardId)
  }, [state.mode, selection.entityId, project])

  const compileResult = useMemo(
    () => compileProjectLogic(state.project, { projectKey: state.projectPath ?? undefined }),
    [boards, state.project, state.projectPath],
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
  const sceneBoards = useMemo(
    () => (project ? logicBoardsForScene(project, sceneId) : []),
    [project, sceneId, boardsRevision],
  )
  const prevBoardsRevision = useRef(boardsRevision)

  useEffect(() => {
    if (prevBoardsRevision.current === boardsRevision) return

    const mainPath = state.project?.mainScriptPath
    const dirtyMain = mainPath
      ? state.openScripts.find(s => s.path === mainPath && s.isDirty)
      : undefined
    if (dirtyMain) return
    if (!compileResult.ok) return

    prevBoardsRevision.current = boardsRevision
    syncLogicBoardToScript(dispatch, state, compileResult.lua)
  }, [boardsRevision, compileResult, dispatch, state])

  const handleApply = useCallback(() => {
    if (!project) return
    executeApplyLogic({
      compileResult,
      runtimeReady,
      state,
      project,
      selectionSceneId: selection.sceneId ?? undefined,
      dispatch,
      flashApplyMsg,
    })
  }, [compileResult, runtimeReady, state, project, selection.sceneId, dispatch, flashApplyMsg])

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
    const b = typeId
      ? createLogicBoardForObjectType(typeId)
      : createLogicBoardForEntity(entityId)
    dispatch({ type: 'LOGIC_ADD_BOARD', board: b })
    setSelectedBoardId(b.boardId)
  }

  const insertClonedEvent = useCallback(
    (source: LogicEvent, targetBoard: LogicBoard, afterEventId?: string) => {
      const copy = cloneLogicEvent(source)
      dispatch({
        type: 'LOGIC_INSERT_EVENT',
        boardId: targetBoard.boardId,
        event: copy,
        afterEventId,
      })
      setFocusedEventId(copy.id)
      setEditingId(copy.id)
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
      if (clip?.kind !== 'event' || !board) return
      insertClonedEvent(
        clip.event,
        board,
        afterEventId ?? focusedEventId ?? undefined,
      )
      showClipboardHint('Rule pasted into this rulesheet')
    },
    [board, focusedEventId, insertClonedEvent, showClipboardHint],
  )

  useEffect(() => {
    if (state.mode !== 'logic' || panelMode !== 'visual') return
    if (sceneBoards.length === 0 && !board) return

    const onKeyDown = (e: KeyboardEvent) => {
      handleLogicBoardClipboardKey(e, {
        sceneBoards,
        activeBoard: board,
        focusedEventId,
        clipboard: clipboardRef.current,
        copyEvent,
        pasteEvent,
        cloneEvent,
      })
    }

    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [
    state.mode,
    panelMode,
    board,
    sceneBoards,
    focusedEventId,
    copyEvent,
    pasteEvent,
    cloneEvent,
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
        setPanelMode={setPanelMode}
        setSelectedBoardId={setSelectedBoardId}
        dispatch={dispatch}
        state={state}
        onApply={handleApply}
      />
    )
  }

  const canCreateForSelection =
    selectedEntityId != null && boardForSelection == null

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]"
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
        applyMsg={applyMsg}
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
        <p className="px-4 py-1.5 text-[10px] leading-snug text-[var(--muted)] border-b border-[var(--border)] bg-[var(--panel-2)]">
          <strong className="text-[var(--text)] font-medium">Base view</strong> — guided
          rules with the full toolset (Canvas, Logic, Script). Use{' '}
          <strong>When</strong> for keys (including OR). Turn on{' '}
          <strong>If</strong> only for extra filters. Switch to{' '}
          <strong>Advanced</strong> on the rail for a denser layout.
        </p>
      )}

      <RulesheetControls
        project={project}
        board={board}
        sceneEntities={sceneEntities}
        selectedEntityId={selectedEntityId}
        boardForSelection={boardForSelection}
        canCreateForSelection={canCreateForSelection}
        advancedOpen={advancedOpen}
        setAdvancedOpen={setAdvancedOpen}
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
      />

      <LogicBoardEventsList
        project={project}
        board={board}
        sceneId={sceneId}
        clipboardHint={clipboardHint}
        editingId={editingId}
        setEditingId={setEditingId}
        focusedEventId={focusedEventId}
        setFocusedEventId={setFocusedEventId}
        newTrigger={newTrigger}
        setNewTrigger={setNewTrigger}
        onCloneEvent={cloneEvent}
        dispatch={dispatch}
      />
    </div>
  )
}
