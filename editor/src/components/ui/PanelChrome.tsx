import type { ReactNode } from 'react'

export type PanelChromeProps = Readonly<{
  title?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}>

/** Panel header + body on --surface. */
export function PanelChrome({ title, actions, children, className = '' }: PanelChromeProps) {
  return (
    <section
      className={`flex flex-col min-h-0 min-w-0 bg-[var(--surface)] border-[var(--outline)] ${className}`.trim()}
    >
      {title != null && title.length > 0 ? (
        <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--outline-subtle)]">
          <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)]">
            {title}
          </h2>
          {actions}
        </header>
      ) : null}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">{children}</div>
    </section>
  )
}
