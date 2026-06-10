// ---------------------------------------------------------------------------
// MainMenu — cascading hamburger menu (root categories + flyout submenus).
//
// The root dropdown shows one row per section (File, Edit, View, Tools,
// Help); hovering or clicking a row opens its submenu in a flyout to the
// right. Replaces the previous single scrolling block that inlined every
// section. Only one submenu is open at a time.
// ---------------------------------------------------------------------------

import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

type MainMenuCategoryProps = Readonly<{
  id: string
  label: string
  icon?: ReactNode
  activeId: string | null
  setActiveId: (id: string | null) => void
  children: ReactNode
}>

/** One root row of the cascade; renders its submenu in a right-side flyout. */
export function MainMenuCategory({
  id,
  label,
  icon,
  activeId,
  setActiveId,
  children,
}: MainMenuCategoryProps) {
  const open = activeId === id
  return (
    <div className="relative" onMouseEnter={() => setActiveId(id)}>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setActiveId(open ? null : id)}
        className={`w-full flex items-center gap-3 px-4 py-2 text-[11px] text-left transition-colors ${
          open
            ? 'bg-[var(--panel-3)] text-[var(--text)]'
            : 'text-[var(--text)] hover:bg-[var(--panel-3)]'
        }`}
      >
        {icon ? <span className="text-[var(--muted)] flex-shrink-0">{icon}</span> : null}
        <span className="flex-1">{label}</span>
        <ChevronRight size={12} className="text-[var(--muted)] flex-shrink-0" />
      </button>
      {open && (
        <div className="editor-menu-flyout" role="menu" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  )
}

/** Tracks which root category currently shows its flyout. */
export function useMainMenuCascade() {
  const [activeId, setActiveId] = useState<string | null>(null)
  return { activeId, setActiveId }
}
