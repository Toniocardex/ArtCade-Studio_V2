import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import { boardDisplayName } from './friendly-labels'
import { logicBoardCompilerLabel } from '../../utils/logic-board/labels'
import { rulesheetAppliesToLabel } from '../../utils/project'
import {
  applyInputBackspace,
  applyInputDelete,
  isBackspaceKey,
  isDeleteKey,
} from '../../utils/keyboard'
import { LogicBoardShortcutsHelp } from './LogicBoardShortcutsHelp'
import { EditorSelect } from '../../components/ui/EditorSelect'

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
  needsApply?: boolean
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
  needsApply,
  project,
}: LogicBoardHeaderProps) {
  const compilerLabel = board ? logicBoardCompilerLabel(board) : ''
  const appliesTo = board ? rulesheetAppliesToLabel(project, board) : null

  return (
    <div className="flex-shrink-0 h-[52px] flex items-center gap-3 px-4 bg-[var(--surface)] border-b border-[var(--outline)]">
      <div className="min-w-0 pr-2">
        {board ? (
          <input
            type="text"
            aria-label="Rulesheet name"
            title="Rulesheet name — the Script editor uses it to label this board's generated Lua"
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
            className="w-52 -mx-1 px-1 py-0.5 rounded bg-transparent border border-transparent
                       text-[13px] font-semibold text-[var(--primary)] truncate
                       hover:border-[var(--outline)] focus:border-[var(--outline-strong)]
                       focus:bg-[var(--surface-3)] focus:outline-none transition-colors"
          />
        ) : (
          <h1 className="truncate text-[13px] font-semibold text-[var(--primary)]">
            Rulesheet
          </h1>
        )}
        <p className="truncate text-[10px] text-[var(--muted)]">
          {appliesTo ? `Applies to: ${appliesTo}` : 'No rulesheet selected'}
        </p>
      </div>

      {boards.length > 1 && (
        <EditorSelect
          className="w-auto min-w-[10rem]"
          value={board?.boardId ?? ''}
          onChange={onSelectBoard}
          placeholder="Select rulesheet…"
          options={boards.map((b) => ({
            value: b.boardId,
            label: boardDisplayName(b, project),
          }))}
          aria-label="Rulesheet"
        />
      )}

      <div className="flex-1" />

      {needsApply && (
        <button
          type="button"
          onClick={onApply}
          className="text-[11px] text-[var(--warn)] hover:underline"
          title="Logic changed since last Apply. Update the preview runtime."
        >
          Apply required
        </button>
      )}

      {applyMsg && (
        <span className="max-w-[220px] truncate text-[11px] text-[var(--muted)]">{applyMsg}</span>
      )}

      <button
        type="button"
        title="Compile the Logic Board to Lua and hot-reload it into the running runtime"
        onClick={onApply}
        className="px-3 py-1.5 rounded text-xs font-semibold border border-[var(--outline-strong)] bg-[var(--surface-2)] text-[var(--primary)] hover:bg-[var(--surface-hover)]"
      >
        Apply
      </button>

      <LogicBoardShortcutsHelp />

      <div className="flex rounded border border-[var(--outline)] overflow-hidden bg-[var(--surface-3)]">
        {(['visual', 'lua'] as const).map((m) => (
          <button
            key={m}
            type="button"
            title={
              m === 'lua'
                ? 'Advanced generated Lua code'
                : 'Visual rules editor'
            }
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-xs ${
              mode === m
                ? 'bg-[var(--surface-selected)] text-[var(--primary)]'
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
