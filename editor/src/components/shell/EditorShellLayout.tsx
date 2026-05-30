import type { ReactNode } from 'react'

export type EditorShellLayoutProps = Readonly<{
  left?: ReactNode
  center: ReactNode
  right?: ReactNode
  leftWidth?: number
  rightWidth?: number
  className?: string
}>

/** Three-column workspace: 280 | flex | 320 defaults via inline width. */
export function EditorShellLayout({
  left,
  center,
  right,
  leftWidth = 280,
  rightWidth = 320,
  className = '',
}: EditorShellLayoutProps) {
  return (
    <div className={`flex flex-1 min-h-0 min-w-0 overflow-hidden ${className}`.trim()}>
      {left != null ? (
        <aside
          style={{ width: leftWidth }}
          className="shrink-0 min-h-0 overflow-hidden border-r border-[var(--outline)] bg-[var(--surface)]"
        >
          {left}
        </aside>
      ) : null}
      <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-[var(--void)]">{center}</main>
      {right != null ? (
        <aside
          style={{ width: rightWidth }}
          className="shrink-0 min-h-0 overflow-hidden border-l border-[var(--outline)] bg-[var(--surface)]"
        >
          {right}
        </aside>
      ) : null}
    </div>
  )
}
