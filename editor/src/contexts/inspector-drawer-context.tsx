import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type InspectorDrawerContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const InspectorDrawerContext = createContext<InspectorDrawerContextValue | null>(null)

export function InspectorDrawerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return (
    <InspectorDrawerContext.Provider value={value}>
      {children}
    </InspectorDrawerContext.Provider>
  )
}

export function useInspectorDrawer(): InspectorDrawerContextValue {
  const ctx = useContext(InspectorDrawerContext)
  if (!ctx) {
    throw new Error('useInspectorDrawer requires InspectorDrawerProvider')
  }
  return ctx
}

/** Toggle for compact-tier canvas toolbar (avoids overlapping runtime badge). */
export function InspectorDrawerToggle() {
  const { open, setOpen } = useInspectorDrawer()
  if (open) return null

  return (
    <button
      type="button"
      className="shrink-0 px-2 py-1 text-[9px] font-semibold rounded border border-[var(--outline)]
                 bg-[var(--surface)] text-[var(--primary)] hover:bg-[var(--surface-hover)]"
      onClick={() => setOpen(true)}
      title="Open inspector"
      aria-label="Open inspector"
    >
      Inspector
    </button>
  )
}
