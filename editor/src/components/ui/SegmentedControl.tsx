// ---------------------------------------------------------------------------
// SegmentedControl — themed exclusive toggle group (2-5 short options)
// ---------------------------------------------------------------------------
//
// For a small, mutually-exclusive choice with short labels, a segmented
// control beats a dropdown: every option is visible, switching is one click,
// and the active state is obvious at a glance. Sibling to EditorSelect, which
// stays the right tool for long / many-option lists. Visuals come from the
// .seg-* classes in editor-shell.css (same idiom as the top-bar module tabs).

import { useRef, type ComponentType, type KeyboardEvent } from 'react'

export type SegmentedOption = Readonly<{
  value: string
  label: string
  /** Native title tooltip on the segment. */
  title?: string
  /** Optional leading icon (lucide component or any SVG-returning component). */
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
}>

export type SegmentedControlProps = Readonly<{
  value: string
  onChange: (value: string) => void
  options: readonly SegmentedOption[]
  /** Wrapper classes — owns layout width. Defaults to w-full. */
  className?: string
  'aria-label'?: string
  id?: string
}>

export function SegmentedControl({
  value,
  onChange,
  options,
  className = 'w-full',
  'aria-label': ariaLabel,
  id,
}: SegmentedControlProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const selectedIndex = options.findIndex((o) => o.value === value)

  function focusAndSelect(index: number) {
    const count = options.length
    if (count === 0) return
    const next = ((index % count) + count) % count
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const base = selectedIndex < 0 ? 0 : selectedIndex
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        focusAndSelect(base + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        focusAndSelect(base - 1)
        break
      case 'Home':
        e.preventDefault()
        focusAndSelect(0)
        break
      case 'End':
        e.preventDefault()
        focusAndSelect(options.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`seg-control ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const active = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[index] = el }}
            type="button"
            role="radio"
            aria-checked={active}
            // Roving tabindex: only the active (or first) segment is tabbable.
            tabIndex={active || (selectedIndex < 0 && index === 0) ? 0 : -1}
            title={option.title}
            className={`seg-option ${active ? 'seg-option--active' : ''}`.trim()}
            onClick={() => onChange(option.value)}
          >
            {Icon && <Icon size={12} aria-hidden />}
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
