// ---------------------------------------------------------------------------
// Logic Board panel — visual event-list editor.
//
// Entity-first: rulesheets bind to entityId by default; class boards in Advanced.
// Script tab: read-only Lua preview + Apri in Editor Script.
//
// All mutations go through LOGIC_*; compiled Lua syncs to mainScriptPath in store.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../store/editor-store'
import {
  allClassNames,
  findLogicBoardForEntity,
  getEntitiesInScene,
} from '../utils/project'
import { compileLogicBoard } from '../utils/logic-board/compiler'
import { editorReloadScript } from '../utils/wasm-bridge'
import { runtimeSync, useRuntimeReady } from '../utils/runtime-sync-service'
import {
  createLogicBoard,
  createLogicBoardForEntity,
} from '../utils/logic-board/factory'
import { cloneLogicEvent } from '../utils/logic-board/clone'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'
import type { LogicEvent, LogicTriggerType } from '../types/logic-board'
import { LogicBoardLuaPreview } from './logic-board/LogicBoardLuaPreview'
import { LogicBoardHeader } from './logic-board/LogicBoardHeader'
import { LogicBoardEventsList } from './logic-board/LogicBoardEventsList'
import { RulesheetControls } from './logic-board/RulesheetControls'
import {
  logicBoardsRevision,
  openMainScriptInEditor,
  syncLogicBoardToScript,
} from '../utils/sync-logic-board-script'

type LogicClipboard = { kind: 'event'; event: LogicEvent } | null

function hasNonEmptyTextSelection(): boolean {
  const sel = window.getSelection()
  return Boolean(sel && sel.toString().length > 0)
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
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [newClass, setNewClass] = useState('')
  const [newTrigger, setNewTrigger] = useState<LogicTriggerType>('onSpawn')
  const [applyMsg, setApplyMsg] = useState<string | null>(null)
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null)
  const [clipboardHint, setClipboardHint] = useState<string | null>(null)
  const clipboardRef = useRef<LogicClipboard>(null)
  const hintTimerRef = useRef<number | null>(null)

  const showClipboardHint = useCallback((msg: string) => {
    setClipboardHint(msg)
    if (hintTimerRef.current != null) window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => setClipboardHint(null), 2000)
  }, [])

  const sceneId = selection.sceneId ?? project?.activeSceneId ?? ''
  const sceneEntities = project ? getEntitiesInScene(project, sceneId) : []

  const board =
    boards.find((b) => b.boardId === selectedBoardId) ?? boards[0] ?? null

  const selectedEntityId = selection.entityId
  const boardForSelection =
    project && selectedEntityId != null
      ? findLogicBoardForEntity(project, selectedEntityId)
      : undefined

  // Sync Scenes-panel selection → rulesheet when in Logic mode.
  useEffect(() => {
    if (state.mode !== 'logic' || !project) return
    const eid = selection.entityId
    if (eid == null) return
    const existing = findLogicBoardForEntity(project, eid)
    if (existing) setSelectedBoardId(existing.boardId)
  }, [state.mode, selection.entityId, project])

  const lua = useMemo(
    () => compileLogicBoard(boards, state.project),
    [boards, state.project],
  )

  const boardsRevision = logicBoardsRevision(project)
  const prevBoardsRevision = useRef(boardsRevision)

  useEffect(() => {
    if (prevBoardsRevision.current === boardsRevision) return

    // Auto-sync compiles the visual board into mainScriptPath every time the
    // board JSON changes. If the user has unsaved manual edits in that exact
    // script tab, overwriting them is silent data loss — the conflict banner
    // exists for *this* case but it only fires AFTER we've already destroyed
    // the buffer. Skip the auto-sync when the tab is dirty; do NOT bump
    // prevBoardsRevision either, so that when the user later resolves the
    // conflict (saves the buffer → isDirty=false), this effect re-fires via
    // the `state` dep and the sync runs against the pending revision.
    const mainPath = state.project?.mainScriptPath
    const dirtyMain = mainPath
      ? state.openScripts.find(s => s.path === mainPath && s.isDirty)
      : undefined
    if (dirtyMain) return

    prevBoardsRevision.current = boardsRevision
    syncLogicBoardToScript(dispatch, state, lua)
  }, [boardsRevision, lua, dispatch, state])

  const handleApply = () => {
    syncLogicBoardToScript(dispatch, state, lua)
    // Always-on guard: the WASM runtime loads asynchronously at editor boot.
    // If the user is fast enough to hit Apply before it finishes, fail with
    // an accurate message rather than telling them to "open Canvas preview"
    // (the preview is already mounted — it's just not ready yet).
    if (!runtimeReady) {
      setApplyMsg('Runtime still loading — try again in a moment.')
      window.setTimeout(() => setApplyMsg(null), 4000)
      return
    }
    if (state.isPlaying && project) {
      dispatch({ type: 'SET_PLAYING', playing: false })
      const activeSceneId = selection.sceneId ?? project.activeSceneId
      const ok = runtimeSync.restorePreviewFromProject(project, activeSceneId, lua)
      if (!ok) {
        setApplyMsg('Runtime call failed — see the console for details.')
        window.setTimeout(() => setApplyMsg(null), 4000)
        return
      }
    } else {
      const ok = editorReloadScript(lua)
      setApplyMsg(
        ok
          ? 'Logic applied — script hot-reloaded (press PLAY to test)'
          : 'Runtime call failed — see the console for details.',
      )
      window.setTimeout(() => setApplyMsg(null), 4000)
      return
    }
    setApplyMsg('Logic applied — preview reset to design state')
    window.setTimeout(() => setApplyMsg(null), 4000)
  }

  const classes = project ? allClassNames(project) : []

  const selectEntityForRules = (entityId: number) => {
    dispatch({ type: 'SELECT_ENTITY', entityId })
    const existing = project && findLogicBoardForEntity(project, entityId)
    if (existing) setSelectedBoardId(existing.boardId)
  }

  const createBoardForEntity = (entityId: number) => {
    if (!project) return
    const existing = findLogicBoardForEntity(project, entityId)
    if (existing) {
      setSelectedBoardId(existing.boardId)
      return
    }
    const b = createLogicBoardForEntity(entityId)
    dispatch({ type: 'LOGIC_ADD_BOARD', board: b })
    setSelectedBoardId(b.boardId)
  }

  const insertClonedEvent = useCallback(
    (source: LogicEvent, afterEventId?: string) => {
      if (!board) return null
      const copy = cloneLogicEvent(source)
      dispatch({
        type: 'LOGIC_INSERT_EVENT',
        boardId: board.boardId,
        event: copy,
        afterEventId,
      })
      setFocusedEventId(copy.id)
      setEditingId(copy.id)
      return copy
    },
    [board, dispatch],
  )

  const cloneEvent = useCallback(
    (ev: LogicEvent) => {
      insertClonedEvent(ev, ev.id)
    },
    [insertClonedEvent],
  )

  const copyEvent = useCallback(
    (ev: LogicEvent) => {
      clipboardRef.current = { kind: 'event', event: structuredClone(ev) }
      showClipboardHint('Regola copiata')
    },
    [showClipboardHint],
  )

  const pasteEvent = useCallback(
    (afterEventId?: string) => {
      const clip = clipboardRef.current
      if (!clip || clip.kind !== 'event') return
      insertClonedEvent(clip.event, afterEventId ?? focusedEventId ?? undefined)
      showClipboardHint('Regola incollata in questo rulesheet')
    },
    [focusedEventId, insertClonedEvent, showClipboardHint],
  )

  useEffect(() => {
    if (state.mode !== 'logic' || panelMode !== 'visual') return

    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreEditorShortcut(e)) return
      if (!e.ctrlKey && !e.metaKey) return
      if (!board) return

      const focused =
        focusedEventId != null
          ? board.events.find((ev) => ev.id === focusedEventId)
          : undefined

      if (e.key === 'c' || e.key === 'C') {
        if (!focused) return
        if (hasNonEmptyTextSelection()) return
        e.preventDefault()
        copyEvent(focused)
      } else if (e.key === 'v' || e.key === 'V') {
        if (clipboardRef.current?.kind !== 'event') return
        e.preventDefault()
        pasteEvent(focused?.id)
      } else if (e.key === 'd' || e.key === 'D') {
        if (!focused) return
        e.preventDefault()
        cloneEvent(focused)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.mode, panelMode, board, focusedEventId, copyEvent, pasteEvent, cloneEvent])

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">
        Open a project to edit Logic Boards.
      </div>
    )
  }

  if (panelMode === 'lua') {
    const mainLabel = project.mainScriptPath.split('/').pop() ?? project.mainScriptPath
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]">
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
        <LogicBoardLuaPreview
          lua={lua}
          title={`${mainLabel} · anteprima generata`}
          action={
            <button
              type="button"
              title="Apri Editor Script con tutte le tab (main, player, …)"
              onClick={() => openMainScriptInEditor(dispatch, state, lua)}
              className="px-4 py-2 rounded text-xs font-semibold border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
            >
              Apri in Editor Script →
            </button>
          }
        />
      </div>
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
          const b = createLogicBoard(newClass)
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
