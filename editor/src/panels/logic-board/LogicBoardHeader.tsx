import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import { boardDisplayName } from './friendly-labels'
import { logicBoardCompilerLabel } from '../../utils/logic-board/labels'
import {
  applyInputBackspace,
  applyInputDelete,
  isBackspaceKey,
  isDeleteKey,
} from '../../utils/keyboard'

export type LogicBoardPanelMode = 'visual' | 'lua'

interface LogicBoardHeaderProps {
  mode: LogicBoardPanelMode
  setMode: (mode: LogicBoardPanelMode) => void
  boards: LogicBoard[]
  board: LogicBoard | null
  onSelectBoard: (id: string) => void
  onRenameBoard: (id: string, name: string) => void
  onApply: () => void
  applyMsg: string | null
  project: ProjectDoc
}

export function LogicBoardHeader({
  mode,
  setMode,
  boards,
  board,
  onSelectBoard,
  onRenameBoard,
  onApply,
  applyMsg,
  project,
}: LogicBoardHeaderProps) {
  const rulesFor = board ? boardDisplayName(board, project) : null
  const compilerLabel = board ? logicBoardCompilerLabel(board) : ''

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
      {board && (
        <input
          type="text"
          aria-label="Rulesheet name"
          title="Rulesheet name used in generated Lua comments"
          value={compilerLabel}
          onChange={(e) => onRenameBoard(board.boardId, e.target.value)}
          onKeyDown={(e) => {
            if (isBackspaceKey(e)) {
              e.preventDefault()
              applyInputBackspace(e.currentTarget)
            } else if (isDeleteKey(e)) {
              e.preventDefault()
              applyInputDelete(e.currentTarget)
            }
          }}
          className="w-52 bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] placeholder:text-[var(--muted)] px-2.5 py-1.5 rounded text-xs"
        />
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
