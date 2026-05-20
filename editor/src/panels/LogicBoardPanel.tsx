// ---------------------------------------------------------------------------
// Logic Board panel — visual event-list editor (iteration 3).
//
// Left: list of LogicEvent cards (collapsed summary / inline editor).
// Right: live read-only Lua preview (recompiled on every store change).
// Visual / Script toggle: Script tab shows live Lua preview + opens full Editor Script.
//
// All mutations go through the store's LOGIC_* actions; the preview derives
// from project.logicBoards via useMemo, so it is always in sync.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../store/editor-store'
import { allClassNames } from '../utils/project'
import { compileLogicBoard } from '../utils/logic-board/compiler'
import { editorReloadScript } from '../utils/wasm-bridge'
import { createLogicBoard, createLogicEvent } from '../utils/logic-board/factory'
import { TRIGGER_TYPES, defaultTrigger } from './logic-board/options'
import type { LogicTriggerType } from '../types/logic-board'
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

  const boards = project?.logicBoards ?? []
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    boards[0]?.boardId ?? null,
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mode, setMode] = useState<'visual' | 'lua'>('visual')
  const [newClass, setNewClass] = useState('')
  const [newTrigger, setNewTrigger] = useState<LogicTriggerType>('onUpdate')
  const [applyMsg, setApplyMsg] = useState<string | null>(null)

  const board =
    boards.find((b) => b.boardId === selectedBoardId) ?? boards[0] ?? null

  // Live Lua — recompiles whenever any board/event changes.
  const lua = useMemo(
    () => compileLogicBoard(boards),
    [boards],
  )

  const boardsRevision = logicBoardsRevision(project)
  const prevBoardsRevision = useRef(boardsRevision)

  // Visual edits → sync compiled Lua into main script buffer (Editor Script / hot-reload).
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

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">
        Open a project to edit Logic Boards.
      </div>
    )
  }

  if (mode === 'lua') {
    const mainLabel = project.mainScriptPath.split('/').pop() ?? project.mainScriptPath
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]">
        <Header
          mode={mode}
          setMode={setMode}
          boards={boards}
          board={board}
          onSelectBoard={setSelectedBoardId}
          onApply={handleApply}
          applyMsg={applyMsg}
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]">
      <Header
        mode={mode}
        setMode={setMode}
        boards={boards}
        board={board}
        onSelectBoard={setSelectedBoardId}
        onApply={handleApply}
        applyMsg={applyMsg}
      />

      {/* board management bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--panel)]">
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          New board · target class
        </span>
        <select
          className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs"
          value={newClass}
          onChange={(e) => setNewClass(e.target.value)}
        >
          <option value="">— pick class —</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          disabled={!newClass}
          onClick={() => {
            const b = createLogicBoard(newClass)
            dispatch({ type: 'LOGIC_ADD_BOARD', board: b })
            setSelectedBoardId(b.boardId)
            setNewClass('')
          }}
          className="px-3 py-1 rounded text-xs font-semibold border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] disabled:opacity-40"
        >
          ＋ New Board
        </button>
        {board && (
          <button
            onClick={() => {
              dispatch({ type: 'LOGIC_DELETE_BOARD', boardId: board.boardId })
              setSelectedBoardId(null)
            }}
            className="px-3 py-1 rounded text-xs text-[var(--muted)] hover:text-[var(--danger)]"
          >
            ⌦ Delete Board
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* LEFT — events */}
        <div className="flex-[1.55] border-r border-[var(--border)] overflow-auto p-4">
          {!board ? (
            <div className="text-[var(--muted)] text-sm mt-8 text-center">
              No Logic Board yet. Pick a target class above and create one.
            </div>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-3">
                Logic Events · {board.events.length} · evaluated every tick(dt)
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

              <div className="flex items-center gap-2 mt-2">
                <select
                  className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1.5 rounded text-xs"
                  value={newTrigger}
                  onChange={(e) =>
                    setNewTrigger(e.target.value as LogicTriggerType)
                  }
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const ev = createLogicEvent(defaultTrigger(newTrigger))
                    dispatch({
                      type: 'LOGIC_ADD_EVENT',
                      boardId: board.boardId,
                      event: ev,
                    })
                    setEditingId(ev.id)
                  }}
                  className="flex-1 px-3 py-2 rounded border border-dashed border-[var(--border-2)] text-[var(--muted)] text-xs hover:text-[var(--accent)] hover:border-[var(--accent-bd)]"
                >
                  ＋ Add Event
                </button>
              </div>
            </>
          )}
        </div>

        <LogicBoardLuaPreview
          lua={lua}
          title="Generated Lua · read-only · live"
          liveDot
        />
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
}: {
  mode: 'visual' | 'lua'
  setMode: (m: 'visual' | 'lua') => void
  boards: { boardId: string; target: { className?: string } }[]
  board: { boardId: string; target: { className?: string } } | null
  onSelectBoard: (id: string) => void
  onApply: () => void
  applyMsg: string | null
}) {
  return (
    <div className="h-[52px] flex items-center gap-3.5 px-4 bg-[var(--panel)] border-b border-[var(--border)]">
      <h1 className="text-sm font-semibold tracking-wide">
        ⬡ Logic <span className="text-[var(--accent)]">Board</span>
      </h1>
      {boards.length > 0 && (
        <select
          className="bg-[var(--border)] border border-[var(--border-2)] text-[var(--accent)] px-2.5 py-1.5 rounded text-xs"
          value={board?.boardId ?? ''}
          onChange={(e) => onSelectBoard(e.target.value)}
        >
          {boards.map((b) => (
            <option key={b.boardId} value={b.boardId}>
              {b.boardId}
            </option>
          ))}
        </select>
      )}
      {board?.target.className && (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border text-[var(--green)] border-[var(--green-bd)] bg-[var(--green-bg)]">
          target ▸ class: {board.target.className}
        </span>
      )}
      <div className="flex-1" />
      {applyMsg && (
        <span className="text-[11px] text-[var(--muted)]">{applyMsg}</span>
      )}
      <button
        title="Compile the Logic Board to Lua and hot-reload it into the running runtime"
        onClick={onApply}
        className="px-3 py-1.5 rounded text-xs font-semibold border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
      >
        ⟳ Apply &amp; Hot-Reload
      </button>
      <div className="flex rounded border border-[var(--border-2)] overflow-hidden">
        {(['visual', 'lua'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-xs ${
              mode === m
                ? 'bg-[var(--border)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {m === 'visual' ? 'Visual' : 'Script'}
          </button>
        ))}
      </div>
    </div>
  )
}
