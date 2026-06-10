// ---------------------------------------------------------------------------
// Themed listbox for Logic Board type pickers (portal; no native select popup).
// ---------------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import {
  flattenTypePickerGroups,
  type TypePickerGroup,
} from './type-picker-groups'

export type LogicTypeListboxProps = Readonly<{
  groups: readonly TypePickerGroup[]
  value: string
  onChange: (type: string) => void
  className?: string
  placeholder?: string
  placeholderValue?: string
  resolveLabel: (type: string) => string
  resolveTooltip?: (type: string) => string | undefined
}>

function isPlaceholderValue(
  value: string,
  placeholderValue: string,
): boolean {
  return value === '' || value === placeholderValue
}

export function LogicTypeListbox({
  groups,
  value,
  onChange,
  className = '',
  placeholder,
  placeholderValue = '',
  resolveLabel,
  resolveTooltip,
}: LogicTypeListboxProps) {
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const flatTypes = useMemo(() => flattenTypePickerGroups(groups), [groups])

  const groupedRows = useMemo(() => {
    let index = 0
    return groups.map((group) => ({
      label: group.label,
      items: group.types.map((type) => ({ type, index: index++ })),
    }))
  }, [groups])
  const showingPlaceholder = isPlaceholderValue(value, placeholderValue)

  const selectedIndex = flatTypes.indexOf(value)
  const triggerLabel = showingPlaceholder
    ? (placeholder ?? 'Select…')
    : resolveLabel(value)

  const close = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  const selectType = useCallback(
    (type: string) => {
      onChange(type)
      close()
      triggerRef.current?.focus()
    },
    [close, onChange],
  )

  useLayoutEffect(() => {
    if (!open) return
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left: r.left,
      minWidth: r.width,
      zIndex: 200,
    })
  }, [open, groups])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const start = selectedIndex >= 0 ? selectedIndex : 0
    setActiveIndex(flatTypes.length > 0 ? start : -1)
  }, [open, flatTypes, selectedIndex])

  useEffect(() => {
    if (!open) return
    menuRef.current?.focus()
  }, [open])

  function moveActive(delta: number) {
    if (flatTypes.length === 0) return
    setActiveIndex((prev) => {
      const base = prev < 0 ? 0 : prev
      const next = (base + delta + flatTypes.length) % flatTypes.length
      return next
    })
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else moveActive(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      else moveActive(-1)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open) {
        const type = activeIndex >= 0 ? flatTypes[activeIndex] : undefined
        if (type) selectType(type)
        return
      }
      setOpen(true)
      return
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      close()
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(flatTypes.length > 0 ? 0 : -1)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(flatTypes.length > 0 ? flatTypes.length - 1 : -1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const type = activeIndex >= 0 ? flatTypes[activeIndex] : undefined
      if (type) selectType(type)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      triggerRef.current?.focus()
    }
  }

  return (
    <div className={`relative w-full ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        className={`logic-type-listbox__trigger w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs text-left ${
          showingPlaceholder ? 'logic-type-listbox__trigger--placeholder' : ''
        }`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            tabIndex={-1}
            className="editor-menu-dropdown logic-type-listbox"
            style={menuStyle}
            onKeyDown={onMenuKeyDown}
          >
            <ul id={listId} role="listbox" className="logic-type-listbox__list">
              {groupedRows.map((group) => (
                <li key={group.label} role="presentation">
                  <div
                    role="group"
                    aria-label={group.label}
                    className="logic-type-listbox__heading"
                  >
                    {group.label}
                  </div>
                  <ul className="logic-type-listbox__group">
                    {group.items.map(({ type, index }) => {
                      const selected = type === value
                      const active = index === activeIndex
                      return (
                        <li key={type} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            title={resolveTooltip?.(type)}
                            className={`logic-type-listbox__option${
                              selected ? ' logic-type-listbox__option--selected' : ''
                            }${active ? ' logic-type-listbox__option--active' : ''}`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => selectType(type)}
                          >
                            {resolveLabel(type)}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  )
}
