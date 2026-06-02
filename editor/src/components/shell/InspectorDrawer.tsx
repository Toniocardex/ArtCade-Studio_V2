import { X } from 'lucide-react'
import InspectorPanel from '../../panels/InspectorPanel'
import { useInspectorDrawer } from '../../contexts/inspector-drawer-context'

/** Right overlay inspector for compact layout tier (ADAPTIVE_LAYOUT D2). */
export function InspectorDrawer() {
  const { open, setOpen } = useInspectorDrawer()

  if (!open) return null

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 z-30 flex flex-col w-[min(280px,90vw)]
                 border-l border-[var(--outline)] bg-[var(--surface)] shadow-[-8px_0_24px_rgb(0_0_0/0.35)]"
      data-panel="inspector-drawer"
    >
      <div className="shrink-0 flex items-center justify-between px-2 py-1 border-b border-[var(--outline)]">
        <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">Inspector</span>
        <button
          type="button"
          className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--muted)]"
          aria-label="Close inspector"
          onClick={() => setOpen(false)}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <InspectorPanel />
      </div>
    </aside>
  )
}
