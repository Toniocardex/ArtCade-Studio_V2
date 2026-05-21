// ---------------------------------------------------------------------------
// Logic Board panel — visual event-list editor.
//
// Entity-first: rulesheets bind to entityId by default; class boards in Advanced.
// Script tab: read-only Lua preview + Apri in Editor Script.
//
// All mutations go through LOGIC_*; compiled Lua syncs to mainScriptPath in store.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../store/editor-store'
import {
  allClassNames,
  classDisplayLabel,
  findLogicBoardForEntity,
  getEntitiesInScene,
  logicBoardLabel,
} from '../utils/project'
import { compileLogicBoard } from '../utils/logic-board/compiler'
import { editorReloadScript } from '../utils/wasm-bridge'
import {
  createLogicBoard,
  createLogicBoardForEntity,
  createLogicEvent,
} from '../utils/logic-board/factory'
import { TRIGGER_TYPES, defaultTrigger } from './logic-board/options'
import { boardDisplayName } from './logic-board/friendly-labels'
import type { ProjectDoc } from '../types'
import type { LogicBoard, LogicTriggerType } from '../types/logic-board'
import { TypePicker } from '../components/logic-board/TypePicker'
import EventCard from './logic-board/EventCard'
import { LogicBoardLuaPreview } from './logic-board/LogicBoardLuaPreview'
import {
  logicBoardsRevision,
  openMainScriptInEditor,
  syncLogicBoardToScript,
} from '../utils/sync-logic-board-script'

export default function LogicBoardPanel() {
  const { state, dispatch } = useEditor()
  const project = state.project
  const { selection } = state

  const boards = project?.logicBoards ?? []
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    boards[0]?.boardId ?? null,
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'visual' | 'lua'>('visual')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [newClass, setNewClass] = useState('')
  const [newTrigger, setNewTrigger] = useState<LogicTriggerType>('onUpdate')
  const [applyMsg, setApplyMsg] = useState<string | null>(null)

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

  const lua = useMemo(() => compileLogicBoard(boards), [boards])

  const boardsRevision = logicBoardsRevision(project)
  const prevBoardsRevision = useRef(boardsRevision)

  useEffect(() => {
    if (prevBoardsRevision.current === boardsRevision) return
    prevBoardsRevision.current = boardsRevision
    syncLogicBoardToScript(dispatch, state, lua)
  }, [boardsRevision, lua, dispatch, state])

  const handleApply = () => {
    syncLogicBoardToScript(dispatch, state, lua)
    const ok = editorReloadScript(lua)
    setApplyMsg(
      ok
        ? 'Sent to runtime — see Console for result'
        : 'Runtime not loaded — press PLAY first',
    )
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
        <Header
          mode={panelMode}
          setMode={setPanelMode}
          boards={boards}
          board={board}
          onSelectBoard={setSelectedBoardId}
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
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]">
      <Header
        mode={panelMode}
        setMode={setPanelMode}
        boards={boards}
        board={board}
        onSelectBoard={setSelectedBoardId}
        onApply={handleApply}
        applyMsg={applyMsg}
        project={project}
      />

      <div className="flex flex-col gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--panel)]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-[var(--muted)]">Rules for entity</span>
          <select
            className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs min-w-[140px]"
            value={selectedEntityId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value)
              if (!Number.isNaN(id)) selectEntityForRules(id)
            }}
          >
            <option value="">Choose entity…</option>
            {sceneEntities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {findLogicBoardForEntity(project, e.id) ? ' · rules' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canCreateForSelection}
            title={
              selectedEntityId == null
                ? 'Select an entity in the Scenes panel first'
                : boardForSelection
                  ? 'This entity already has a rulesheet'
                  : 'Create rulesheet for selected entity'
            }
            onClick={() => {
              if (selectedEntityId != null) createBoardForEntity(selectedEntityId)
            }}
            className="px-3 py-1 rounded text-xs font-semibold border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] disabled:opacity-40"
          >
            New rulesheet for selection
          </button>
          {board && (
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'LOGIC_DELETE_BOARD', boardId: board.boardId })
                setSelectedBoardId(null)
              }}
              className="px-3 py-1 rounded text-xs text-[var(--muted)] hover:text-[var(--danger)]"
            >
              Delete rulesheet
            </button>
          )}
        </div>

        <details
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
          className="text-xs"
        >
          <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--text)] select-none">
            Advanced — shared rulesheet (class)
          </summary>
          <p className="text-[10px] text-[var(--muted)] mt-1 mb-2 max-w-xl">
            Use only when many identical objects share one behavior. Default workflow is one rulesheet per entity in the Scenes panel.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs"
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
            >
              <option value="">Choose class…</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {classDisplayLabel(project, c)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!newClass}
              onClick={() => {
                const b = createLogicBoard(newClass)
                dispatch({ type: 'LOGIC_ADD_BOARD', board: b })
                setSelectedBoardId(b.boardId)
                setNewClass('')
              }}
              className="px-3 py-1 rounded text-xs font-semibold border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] disabled:opacity-40"
            >
              New class rulesheet
            </button>
          </div>
        </details>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {!board ? (
          <div className="text-[var(--muted)] text-sm mt-8 text-center max-w-md mx-auto leading-relaxed">
            Select an entity in the Scenes panel, then create a rulesheet with{' '}
            <span className="text-[var(--text)]">New rulesheet for selection</span>.
          </div>
        ) : (
          <>
            <div className="text-xs text-[var(--muted)] mb-3">
              Rules for{' '}
              <span className="text-[var(--text)] font-medium">
                {logicBoardLabel(project, board)}
              </span>{' '}
              ({board.events.length})
            </div>

            {board.events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                editing={editingId === ev.id}
                onToggleEnabled={() =>
                  dispatch({
                    type: 'LOGIC_UPDATE_EVENT',
                    boardId: board.boardId,
                    event: { ...ev, enabled: !ev.enabled },
                  })
                }
                onEdit={() =>
                  setEditingId(editingId === ev.id ? null : ev.id)
                }
                onDelete={() => {
                  dispatch({
                    type: 'LOGIC_DELETE_EVENT',
                    boardId: board.boardId,
                    eventId: ev.id,
                  })
                  if (editingId === ev.id) setEditingId(null)
                }}
                onChange={(next) =>
                  dispatch({
                    type: 'LOGIC_UPDATE_EVENT',
                    boardId: board.boardId,
                    event: next,
                  })
                }
                onDoneEditing={() => setEditingId(null)}
              />
            ))}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <TypePicker
                kind="trigger"
                types={TRIGGER_TYPES}
                value={newTrigger}
                onChange={(t) => setNewTrigger(t as LogicTriggerType)}
                className="max-w-[240px]"
              />
              <button
                type="button"
                onClick={() => {
                  const ev = createLogicEvent(defaultTrigger(newTrigger))
                  dispatch({
                    type: 'LOGIC_ADD_EVENT',
                    boardId: board.boardId,
                    event: ev,
                  })
                  setEditingId(ev.id)
                }}
                className="flex-1 min-w-[140px] px-3 py-2 rounded border border-dashed border-[var(--border-2)] text-[var(--muted)] text-xs hover:text-[var(--accent)] hover:border-[var(--accent-bd)]"
              >
                Add rule
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---- header ---------------------------------------------------------------

function Header({
  mode,
  setMode,
  boards,
  board,
  onSelectBoard,
  onApply,
  applyMsg,
  project,
}: {
  mode: 'visual' | 'lua'
  setMode: (m: 'visual' | 'lua') => void
  boards: LogicBoard[]
  board: LogicBoard | null
  onSelectBoard: (id: string) => void
  onApply: () => void
  applyMsg: string | null
  project: ProjectDoc
}) {
  const rulesFor = board ? boardDisplayName(board, project) : null

  return (
    <div className="h-[52px] flex items-center gap-3.5 px-4 bg-[var(--panel)] border-b border-[var(--border)]">
      <h1 className="text-sm font-semibold tracking-wide">
        ⬡ Logic <span className="text-[var(--accent)]">Board</span>
      </h1>
      {rulesFor && (
        <span className="text-[11px] text-[var(--muted)]">
          Rules for <span className="text-[var(--text)] font-medium">{rulesFor}</span>
        </span>
      )}
      {boards.length > 0 && (
        <select
          className="bg-[var(--border)] border border-[var(--border-2)] text-[var(--accent)] px-2.5 py-1.5 rounded text-xs"
          value={board?.boardId ?? ''}
          onChange={(e) => onSelectBoard(e.target.value)}
        >
          {boards.map((b) => (
            <option key={b.boardId} value={b.boardId}>
              {boardDisplayName(b, project)}
            </option>
          ))}
        </select>
      )}
      <div className="flex-1" />
      {applyMsg && (
        <span className="text-[11px] text-[var(--muted)]">{applyMsg}</span>
      )}
      <button
        type="button"
        title="Compile the Logic Board to Lua and hot-reload it into the running runtime"
        onClick={onApply}
        className="px-3 py-1.5 rounded text-xs font-semibold border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
      >
        Apply to game
      </button>
      <div className="flex rounded border border-[var(--border-2)] overflow-hidden">
        {(['visual', 'lua'] as const).map((m) => (
          <button
            key={m}
            type="button"
            title={
              m === 'lua'
                ? 'Advanced · generated Lua code'
                : 'Visual rules editor'
            }
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-xs ${
              mode === m
                ? 'bg-[var(--border)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {m === 'visual' ? 'Rules' : 'Script'}
          </button>
        ))}
      </div>
    </div>
  )
}
