// ---------------------------------------------------------------------------
// EditorSelect — themed replacement for native <select> (portal listbox)
// ---------------------------------------------------------------------------
//
// Native select popups are OS-rendered: they ignore the design system's
// surfaces, radii and typography even with color-scheme set. Every dropdown
// in the editor shell goes through this component instead, so the popup is a
// real DOM listbox styled by index.css (.editor-listbox*). API mirrors a
// native select: string value in, string value out.

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
import { EditorSelectMenu } from './EditorSelectMenu'

export type EditorSelectOption = Readonly<{
  value: string
  label: string
  /** Tooltip on the option row. */
  title?: string
}>

export type EditorSelectGroup = Readonly<{
  /** Optional heading; omit for an unlabelled group. */
  label?: string
  options: readonly EditorSelectOption[]
}>

export type EditorSelectProps = Readonly<{
  value: string
  onChange: (value: string) => void
  /** Flat list; use `groups` for headed sections instead. */
  options?: readonly EditorSelectOption[]
  groups?: readonly EditorSelectGroup[]
  /** Trigger label when `value` matches no option (e.g. '' before a pick). */
  placeholder?: string
  /** Wrapper classes — owns layout width. Defaults to w-full. */
  className?: string
  /** Extra trigger classes (size/typography tweaks only). */
  triggerClassName?: string
  disabled?: boolean
  title?: string
  id?: string
  'aria-label'?: string
}>

const HIDDEN_MENU_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  visibility: 'hidden',
  zIndex: 200,
}

export function EditorSelect({
  value,
  onChange,
  options,
  groups,
  placeholder,
  className = 'w-full',
  triggerClassName = '',
  disabled = false,
  title,
  id,
  'aria-label': ariaLabel,
}: EditorSelectProps) {
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>(HIDDEN_MENU_STYLE)

  const normalizedGroups = useMemo<readonly EditorSelectGroup[]>(
    () => groups ?? [{ options: options ?? [] }],
    [groups, options],
  )
  const flat = useMemo(
    () => normalizedGroups.flatMap((g) => g.options),
    [normalizedGroups],
  )

  const groupedRows = useMemo(() => {
    let index = 0
    return normalizedGroups.map((group) => ({
      label: group.label,
      items: group.options.map((option) => ({ option, index: index++ })),
    }))
  }, [normalizedGroups])

  const selectedIndex = flat.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? flat[selectedIndex] : undefined
  const triggerLabel = selected?.label ?? placeholder ?? value ?? ''
  const activeOptionId = activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined

  const close = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
    setMenuStyle(HIDDEN_MENU_STYLE)
  }, [])

  const selectValue = useCallback(
    (next: string) => {
      onChange(next)
      close()
      triggerRef.current?.focus()
    },
    [close, onChange],
  )

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    const rect = trigger.getBoundingClientRect()
    const menuHeight = menu.offsetHeight
    const below = rect.bottom + 4
    const top = below + menuHeight > window.innerHeight && rect.top - 4 - menuHeight >= 0
      ? rect.top - 4 - menuHeight
      : below
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8),
    )
    setMenuStyle({ position: 'fixed', top, left, minWidth: rect.width, zIndex: 200 })
  }, [])

  // Position after the menu has rendered hidden, so its real size is known:
  // flip above the trigger when the viewport bottom would clip it. Capture
  // scroll from nested inspector panes because scroll events do not bubble.
  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    document.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      document.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, flat, updateMenuPosition])

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
    setActiveIndex(flat.length > 0 ? start : -1)
  }, [open, flat, selectedIndex])

  function moveActive(delta: number) {
    if (flat.length === 0) return
    setActiveIndex((prev) => {
      const base = prev < 0 ? 0 : prev
      return (base + delta + flat.length) % flat.length
    })
  }

  function moveActiveToPrefix(prefix: string) {
    if (flat.length === 0) return
    const normalizedPrefix = prefix.toLocaleLowerCase()
    const start = activeIndex >= 0 ? activeIndex + 1 : 0
    for (let offset = 0; offset < flat.length; offset += 1) {
      const index = (start + offset) % flat.length
      if (flat[index].label.toLocaleLowerCase().startsWith(normalizedPrefix)) {
        setActiveIndex(index)
        return
      }
    }
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
        const option = activeIndex >= 0 ? flat[activeIndex] : undefined
        if (option) selectValue(option.value)
        return
      }
      setOpen(true)
      return
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'Home' && open) {
      e.preventDefault()
      setActiveIndex(flat.length > 0 ? 0 : -1)
      return
    }
    if (e.key === 'End' && open) {
      e.preventDefault()
      setActiveIndex(flat.length > 0 ? flat.length - 1 : -1)
      return
    }
    if (e.key === 'Tab' && open) {
      close()
      return
    }
    if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      if (!open) setOpen(true)
      moveActiveToPrefix(e.key)
    }
  }

  return (
    <div className={`relative ${className}`.trim()}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        className={`editor-listbox__trigger w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs text-left disabled:opacity-50 ${
          selected ? '' : 'editor-listbox__trigger--placeholder'
        } ${triggerClassName}`.trim()}
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
          <EditorSelectMenu
            menuRef={menuRef}
            listId={listId}
            style={menuStyle}
            groups={groupedRows}
            value={value}
            activeIndex={activeIndex}
            onActivate={setActiveIndex}
            onSelect={selectValue}
          />,
          document.body,
        )}
    </div>
  )
}
