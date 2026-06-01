import type { ReactNode } from 'react'

export type DockPanelChromeProps = Readonly<{
  title: string
  children: ReactNode
  className?: string
}>

/** Column header inside the 4-up bottom dock (mockup-style). */
export function DockPanelChrome({ title, children, className = '' }: DockPanelChromeProps) {
  return (
    <section
      className={`flex flex-col min-w-0 min-h-0 h-full border-r border-[var(--outline)] last:border-r-0 ${className}`.trim()}
    >
      <div className="shrink-0 px-2 py-1 border-b border-[var(--outline)] bg-[var(--surface-2)]
                      text-[8px] font-bold uppercase tracking-widest text-[var(--muted)] truncate">
        {title}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden bg-[var(--panel-3)]">
        {children}
      </div>
    </section>
  )
}
