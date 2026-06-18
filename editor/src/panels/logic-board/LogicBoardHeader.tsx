import { AlertTriangle, Check, RefreshCw } from 'lucide-react'
import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import { boardDisplayName } from './friendly-labels'
import { logicBoardCompilerLabel } from '../../utils/logic-board/labels'
import { rulesheetAppliesToLabel } from '../../utils/project'
import type { LogicSyncStatus } from '../../utils/logic-board/auto-apply-status'
import { handleControlledInputKeyDown } from '../../utils/keyboard'
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
  /** Manual apply — only surfaced while playing (it restarts the preview). */
  onApply: () => void
  onRetrySync: () => void
  applyMsg: string | null
  syncStatus: LogicSyncStatus
  project: ProjectDoc
  sceneHasObjects?: boolean
}

function SyncStatusChip({
  status,
  onApply,
  onRetrySync,
}: Readonly<{
  status: LogicSyncStatus
  onApply: () => void
  onRetrySync: () => void
}>) {
  const chip = 'inline-flex items-center gap-1.5 text-[11px]'
  switch (status.kind) {
    case 'no-board':
      return null
    case 'synced':
      return (
        <span className={`${chip} text-[var(--muted)]`} title="Rules are live in the preview runtime">
          <Check size={12} aria-hidden /> Synced
        </span>
      )
    case 'syncing':
      return (
        <span className={`${chip} text-[var(--muted)]`} title="Compiling and hot-reloading into the preview runtime">
          <RefreshCw size={12} className="animate-spin" aria-hidden /> Syncing…
        </span>
      )
    case 'runtime-loading':
      return (
        <span className={`${chip} text-[var(--muted)]`} title="Changes will sync as soon as the runtime is ready">
          <RefreshCw size={12} aria-hidden /> Waiting for runtime…
        </span>
      )
    case 'compile-error':
      return (
        <span
          className={`${chip} text-[var(--danger)]`}
          title={status.detail ?? 'Fix the compile error to resume sync'}
        >
          <AlertTriangle size={12} aria-hidden /> Compile error
        </span>
      )
    case 'play-pending':
      return (
        <span className={`${chip} text-[var(--warn)]`}>
          Changes pending
          <button
            type="button"
            onClick={onApply}
            title="Apply the new rules now — stops play and resets the preview"
            className="rounded border border-[var(--warn)] px-2 py-1 text-[11px] font-semibold
                       text-[var(--warn)] hover:bg-[rgb(var(--warn-rgb)/0.1)]"
          >
            Apply (restarts play)
          </button>
        </span>
      )
    case 'failed':
      return (
        <span className={`${chip} text-[var(--danger)]`} title={status.detail}>
          <AlertTriangle size={12} aria-hidden /> Sync failed
          <button
            type="button"
            onClick={onRetrySync}
            className="rounded border border-[var(--outline-strong)] px-2 py-1 text-[11px] font-semibold
                       text-[var(--text)] hover:bg-[var(--surface-hover)]"
          >
            Retry
          </button>
        </span>
      )
  }
}

export function LogicBoardHeader({
  mode,
  setMode,
  boards,
  board,
  onSelectBoard,
  onRenameBoard,
  onApply,
  onRetrySync,
  applyMsg,
  syncStatus,
  project,
  sceneHasObjects = true,
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
            onKeyDown={(e) => handleControlledInputKeyDown(e, (value) => {
              onRenameBoard(board.boardId, value)
            })}
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
          {appliesTo
            ? `Applies to: ${appliesTo}`
            : sceneHasObjects
              ? 'No rulesheet selected'
              : 'Scene has no objects'}
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

      {applyMsg && (
        <span className="max-w-[220px] truncate text-[11px] text-[var(--muted)]">{applyMsg}</span>
      )}

      <SyncStatusChip status={syncStatus} onApply={onApply} onRetrySync={onRetrySync} />

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
