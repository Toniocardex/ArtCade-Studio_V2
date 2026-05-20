import type { ReactNode } from 'react'

/** Shared read-only Lua output (Visual side panel + Script tab preview). */
export function LogicBoardLuaPreview({
  lua,
  title,
  action,
  liveDot = false,
}: {
  lua: string
  title: string
  action?: ReactNode
  liveDot?: boolean
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--panel-3)]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--panel)] min-h-9">
        {liveDot && <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] flex-shrink-0" />}
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{title}</span>
        {action && (
          <>
            <span className="flex-1" />
            {action}
          </>
        )}
      </div>
      <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed text-[var(--text-2)] font-mono whitespace-pre">
        {lua}
      </pre>
    </div>
  )
}
