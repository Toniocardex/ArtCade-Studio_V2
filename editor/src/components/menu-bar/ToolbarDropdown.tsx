import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

export type ToolbarDropdownProps = Readonly<{
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  align?: 'left' | 'right'
  onClose: () => void
  children: ReactNode
  className?: string
}>

/** Menubar dropdown rendered in a top-layer portal (avoids overflow/z-index clipping). */
export function ToolbarDropdown({
  open,
  anchorRef,
  align = 'left',
  onClose,
  children,
  className = '',
}: ToolbarDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    if (!open) return
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const top = r.bottom + 4
    if (align === 'right') {
      setStyle({
        position: 'fixed',
        top,
        right: Math.max(8, globalThis.innerWidth - r.right),
        zIndex: 200,
      })
    } else {
      setStyle({
        position: 'fixed',
        top,
        left: r.left,
        zIndex: 200,
      })
    }
  }, [open, anchorRef, align])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      data-toolbar-dropdown
      className={`editor-menu-dropdown ${className}`.trim()}
      style={style}
      role="menu"
    >
      {children}
    </div>,
    document.body,
  )
}
