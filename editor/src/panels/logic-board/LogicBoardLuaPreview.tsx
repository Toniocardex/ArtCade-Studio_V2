import type { ReactNode } from 'react'

/** Read-only compiled Lua preview (Logic Board Script tab only). */
export function LogicBoardLuaPreview({
  lua,
  title,
  subtitle,
  emptyMessage,
  action,
  secondaryAction,
}: {
  lua: string
  title: string
  subtitle?: string
  emptyMessage?: string
  action?: ReactNode
  secondaryAction?: ReactNode
}) {
  const isEmpty = lua.trim().length === 0

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--panel-3)]">
      <div className="flex items-start gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--panel)] min-h-9">
        <div className="flex flex-col gap-0.5 min-w-0 py-0.5">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{title}</span>
          {subtitle && (
            <span className="text-[10px] text-[var(--muted)] normal-case tracking-normal">{subtitle}</span>
          )}
        </div>
        {(action || secondaryAction) && (
          <>
            <span className="flex-1" />
            <div className="flex items-center gap-2 flex-shrink-0">
              {secondaryAction}
              {action}
            </div>
          </>
        )}
      </div>
      {isEmpty && emptyMessage ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-[var(--muted)]">
          {emptyMessage}
        </div>
      ) : (
        <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed text-[var(--text-2)] font-mono whitespace-pre">
          {lua}
        </pre>
      )}
    </div>
  )
}
