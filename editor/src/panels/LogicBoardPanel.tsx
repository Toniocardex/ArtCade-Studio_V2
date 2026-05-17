// ---------------------------------------------------------------------------
// Logic Board panel — visual event-list editor (iteration 3).
//
// Left: list of LogicEvent cards (collapsed summary / inline editor).
// Right: live read-only Lua preview (recompiled on every store change).
// A Visual/Lua toggle preserves access to the raw Monaco script editor.
//
// All mutations go through the store's LOGIC_* actions; the preview derives
// from project.logicBoards via useMemo, so it is always in sync.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { useEditor } from '../store/editor-store'
import { allClassNames } from '../utils/project'
import { compileLogicBoard } from '../utils/logic-board/compiler'
import { createLogicBoard, createLogicEvent } from '../utils/logic-board/factory'
import { TRIGGER_TYPES, defaultTrigger } from './logic-board/options'
import type { LogicTriggerType } from '../types/logic-board'
import EventCard from './logic-board/EventCard'
import ScriptEditorPanel from './ScriptEditorPanel'

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

  const board =
    boards.find((b) => b.boardId === selectedBoardId) ?? boards[0] ?? null

  // Live Lua — recompiles whenever any board/event changes.
  const lua = useMemo(
    () => compileLogicBoard(boards),
    [boards],
  )

  const classes = project ? allClassNames(project) : []

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#9CA3AF] text-sm">
        Open a project to edit Logic Boards.
      </div>
    )
  }

  if (mode === 'lua') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <Header
          mode={mode}
          setMode={setMode}
          boards={boards}
          board={board}
          onSelectBoard={setSelectedBoardId}
        />
        <div className="flex-1 min-h-0">
          <ScriptEditorPanel />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B1121]">
      <Header
        mode={mode}
        setMode={setMode}
        boards={boards}
        board={board}
        onSelectBoard={setSelectedBoardId}
      />

      {/* board management bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1A253A] bg-[#111827]">
        <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">
          New board · target class
        </span>
        <select
          className="bg-[#0B1121] border border-[#2D3748] text-[#00FFFF] px-2 py-1 rounded text-xs"
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
          className="px-3 py-1 rounded text-xs font-semibold border border-[#2D3748] bg-[#1A253A] text-[#D1D5DB] disabled:opacity-40"
        >
          ＋ New Board
        </button>
        {board && (
          <button
            onClick={() => {
              dispatch({ type: 'LOGIC_DELETE_BOARD', boardId: board.boardId })
              setSelectedBoardId(null)
            }}
            className="px-3 py-1 rounded text-xs text-[#9CA3AF] hover:text-[#F87171]"
          >
            ⌦ Delete Board
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* LEFT — events */}
        <div className="flex-[1.55] border-r border-[#1A253A] overflow-auto p-4">
          {!board ? (
            <div className="text-[#9CA3AF] text-sm mt-8 text-center">
              No Logic Board yet. Pick a target class above and create one.
            </div>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-widest text-[#9CA3AF] mb-3">
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
                  className="bg-[#0B1121] border border-[#2D3748] text-[#00FFFF] px-2 py-1.5 rounded text-xs"
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
                  className="flex-1 px-3 py-2 rounded border border-dashed border-[#2D3748] text-[#9CA3AF] text-xs hover:text-[#00FFFF] hover:border-[#0a5a5a]"
                >
                  ＋ Add Event
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — live Lua */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0E1626]">
          <div className="h-9 flex items-center gap-2 px-4 border-b border-[#1A253A] bg-[#111827]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
            <span className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
              Generated Lua · read-only · live
            </span>
          </div>
          <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed text-[#c8d2e0] font-mono whitespace-pre">
            {lua}
          </pre>
        </div>
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
}: {
  mode: 'visual' | 'lua'
  setMode: (m: 'visual' | 'lua') => void
  boards: { boardId: string; target: { className?: string } }[]
  board: { boardId: string; target: { className?: string } } | null
  onSelectBoard: (id: string) => void
}) {
  return (
    <div className="h-[52px] flex items-center gap-3.5 px-4 bg-[#111827] border-b border-[#1A253A]">
      <h1 className="text-sm font-semibold tracking-wide">
        ⬡ Logic <span className="text-[#00FFFF]">Board</span>
      </h1>
      {boards.length > 0 && (
        <select
          className="bg-[#1A253A] border border-[#2D3748] text-[#00FFFF] px-2.5 py-1.5 rounded text-xs"
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
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border text-[#34D399] border-[#1f6b4f] bg-[#0e2a20]">
          target ▸ class: {board.target.className}
        </span>
      )}
      <div className="flex-1" />
      <button
        title="Hot-reload pipeline arrives in iteration 4"
        disabled
        className="px-3 py-1.5 rounded text-xs font-semibold border border-[#0a5a5a] bg-[#062a2a] text-[#00FFFF] opacity-40 cursor-not-allowed"
      >
        ⟳ Apply &amp; Hot-Reload
      </button>
      <div className="flex rounded border border-[#2D3748] overflow-hidden">
        {(['visual', 'lua'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-xs ${
              mode === m
                ? 'bg-[#1A253A] text-[#00FFFF]'
                : 'text-[#9CA3AF] hover:text-[#D1D5DB]'
            }`}
          >
            {m === 'visual' ? 'Visual' : 'Lua'}
          </button>
        ))}
      </div>
    </div>
  )
}
