import type { ReactNode } from 'react'

/** Read-only compiled Lua preview (Logic Board Script tab only). */
export function LogicBoardLuaPreview({
  lua,
  title,
  action,
}: {
  lua: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--panel-3)]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--panel)] min-h-9">
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
