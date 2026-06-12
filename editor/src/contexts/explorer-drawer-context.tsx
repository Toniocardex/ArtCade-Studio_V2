import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type ExplorerDrawerContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const ExplorerDrawerContext = createContext<ExplorerDrawerContextValue | null>(null)

export function ExplorerDrawerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return (
    <ExplorerDrawerContext.Provider value={value}>
      {children}
    </ExplorerDrawerContext.Provider>
  )
}

export function useExplorerDrawer(): ExplorerDrawerContextValue {
  const ctx = useContext(ExplorerDrawerContext)
  if (!ctx) {
    throw new Error('useExplorerDrawer requires ExplorerDrawerProvider')
  }
  return ctx
}

/** Toggle for minimal-tier canvas toolbar (shown when the left sidebar is hidden). */
export function ExplorerDrawerToggle() {
  const { open, setOpen } = useExplorerDrawer()
  if (open) return null

  return (
    <button
      type="button"
      className="shrink-0 px-2 py-1 text-[9px] font-semibold rounded border border-[var(--outline)]
                 bg-[var(--surface)] text-[var(--primary)] hover:bg-[var(--surface-hover)]"
      onClick={() => setOpen(true)}
      title="Open project explorer"
      aria-label="Open project explorer"
    >
      Explorer
    </button>
  )
}
