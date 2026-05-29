import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export type ExplorerContextMenuItem = Readonly<{
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}>

export type ExplorerContextMenuState = Readonly<{
  x: number
  y: number
  items: readonly ExplorerContextMenuItem[]
}>

export function ExplorerContextMenu({
  state,
  onClose,
}: Readonly<{
  state: ExplorerContextMenuState | null
  onClose: () => void
}>) {
  useEffect(() => {
    if (!state) return
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target
      if (target instanceof Element && target.closest('[data-explorer-context-menu]')) return
      onClose()
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [state, onClose])

  if (!state) return null

  return createPortal(
    <div
      data-explorer-context-menu
      role="menu"
      className="fixed z-[200] min-w-[10.5rem] py-1 rounded border border-[var(--border)]
                 bg-[var(--panel)] shadow-lg"
      style={{ left: state.x, top: state.y }}
    >
      {state.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return
            item.onSelect()
            onClose()
          }}
          className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors disabled:opacity-40
            ${
              item.danger
                ? 'text-[var(--danger)] hover:bg-[rgb(var(--danger-rgb)/0.12)]'
                : 'text-[var(--text)] hover:bg-[rgb(var(--border-rgb)/0.35)]'
            }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

export function openExplorerContextMenu(
  ev: React.MouseEvent,
  items: readonly ExplorerContextMenuItem[],
  setMenu: (state: ExplorerContextMenuState | null) => void,
): void {
  ev.preventDefault()
  ev.stopPropagation()
  setMenu({ x: ev.clientX, y: ev.clientY, items })
}
