// ---------------------------------------------------------------------------
// CatalogPicker — command-palette modal for trigger/action/condition catalogs.
// Search-first, category rail, keyboard navigation (↑↓ Enter, Tab = category).
// Deliberately sober: fade-only, 0.3 backdrop, no click-outside dismiss.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Brain,
  Camera,
  Clock,
  Eye,
  Film,
  Hand,
  Heart,
  Keyboard,
  List,
  MessageSquare,
  Move,
  Orbit,
  RefreshCw,
  Repeat,
  Search,
  Settings2,
  Star,
  Target,
  Variable,
  Volume2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ComponentKind } from '../../utils/logic-board/schema-registry'
import type {
  LogicActionType,
  LogicCondition,
  LogicTriggerType,
} from '../../types/logic-board'
import {
  actionDisplayName,
  conditionDisplayName,
  triggerDisplayName,
  typeDescription,
} from '../../panels/logic-board/friendly-labels'
import { buildTypePickerGroups } from './type-picker-groups'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Recommended for this object': Star,
  'Common checks': Star,
  Time: Clock,
  'Object state': Box,
  Contact: Hand,
  Zones: Target,
  Input: Keyboard,
  Animation: Film,
  'Game messages': MessageSquare,
  Messaging: MessageSquare,
  'Every frame': Repeat,
  Movement: Move,
  Health: Heart,
  'AI Logic': Brain,
  Lifecycle: RefreshCw,
  Audio: Volume2,
  Entities: Box,
  Graphics: Eye,
  Camera: Camera,
  Physics: Orbit,
  State: Variable,
  System: Settings2,
  Advanced: Settings2,
}

function categoryIcon(label: string): LucideIcon {
  return CATEGORY_ICONS[label] ?? Box
}

function displayName(kind: ComponentKind, type: string): string {
  if (kind === 'trigger') return triggerDisplayName(type as LogicTriggerType)
  if (kind === 'action') return actionDisplayName(type as LogicActionType)
  return conditionDisplayName(type as LogicCondition['type'])
}

type CatalogRow = Readonly<{
  type: string
  name: string
  description: string
  category: string
}>

export type CatalogPickerProps = Readonly<{
  kind: ComponentKind
  /** Dialog heading, e.g. "New rule — choose when it runs". */
  title: string
  subtitle?: string
  types: readonly string[]
  recommendedTypes?: readonly string[]
  searchPlaceholder?: string
  onPick: (type: string) => void
  onClose: () => void
}>

export function CatalogPicker({
  kind,
  title,
  subtitle,
  types,
  recommendedTypes,
  searchPlaceholder,
  onPick,
  onClose,
}: CatalogPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)

  const groups = useMemo(
    () => buildTypePickerGroups(kind, types, { recommendedTypes }),
    [kind, types, recommendedTypes],
  )

  const categories = useMemo(() => groups.map((g) => g.label), [groups])

  const allRows: readonly CatalogRow[] = useMemo(
    () =>
      groups.flatMap((g) =>
        g.types.map((type) => ({
          type,
          name: displayName(kind, type),
          description: typeDescription(kind, type) ?? g.label,
          category: g.label,
        })),
      ),
    [groups, kind],
  )

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRows.filter(
      (r) =>
        (activeCategory == null || r.category === activeCategory) &&
        (!q || `${r.name} ${r.description}`.toLowerCase().includes(q)),
    )
  }, [allRows, activeCategory, query])

  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) el.showModal()
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [onClose])

  // Clamp selection when the visible list shrinks (typing / category switch).
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, visibleRows.length - 1)))
  }, [visibleRows.length])

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected, visibleRows])

  function cycleCategory(dir: 1 | -1) {
    const order: (string | null)[] = [null, ...categories]
    const i = order.indexOf(activeCategory)
    const next = order[(i + dir + order.length) % order.length]
    setActiveCategory(next)
    setSelected(0)
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, visibleRows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = visibleRows[selected]
      if (row) onPick(row.type)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      cycleCategory(e.shiftKey ? -1 : 1)
    }
  }

  const showGroupHeaders = activeCategory == null && query.trim() === ''
  let lastGroup = ''

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="catalog-picker-title"
      aria-modal
      className="artcade-dialog fixed inset-0 z-[210] m-0 flex h-full max-h-full w-full
                 max-w-full items-center justify-center border-0 bg-transparent p-6
                 backdrop:bg-black/30"
    >
      <div className="flex h-[480px] max-h-[80vh] w-full max-w-[620px] flex-col overflow-hidden
                      rounded-lg border border-[var(--border-2)] bg-[var(--panel)] text-[var(--text)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
          <div className="min-w-0">
            <h2 id="catalog-picker-title" className="truncate text-xs font-semibold">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--panel-3)] hover:text-[var(--text)]"
          >
            <X size={15} />
          </button>
        </header>

        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-2.5">
          <Search size={14} className="flex-shrink-0 text-[var(--muted)]" aria-hidden />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={onSearchKeyDown}
            placeholder={searchPlaceholder ?? 'Search…'}
            aria-label="Search catalog"
            className="h-6 flex-1 border-none bg-transparent text-xs text-[var(--text)]
                       outline-none placeholder:text-[var(--muted)]"
          />
          <kbd className="rounded border border-[var(--border-2)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">
            Esc
          </kbd>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Categories"
            className="w-[150px] flex-shrink-0 overflow-y-auto panel-scroll border-r border-[var(--border)] p-1.5"
          >
            {[null, ...categories].map((cat) => {
              const Icon = cat == null ? List : categoryIcon(cat)
              const active = activeCategory === cat
              return (
                <button
                  key={cat ?? '__all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setActiveCategory(cat)
                    setSelected(0)
                    searchRef.current?.focus()
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[11px]
                              transition-colors ${
                                active
                                  ? 'bg-[rgb(var(--accent-rgb)/0.16)] text-[var(--text)]'
                                  : 'text-[var(--muted)] hover:text-[var(--text)]'
                              }`}
                >
                  <Icon size={13} className="flex-shrink-0" aria-hidden />
                  <span className="truncate">{cat ?? 'All'}</span>
                </button>
              )
            })}
          </nav>

          <div
            ref={listRef}
            role="listbox"
            aria-label={`${kind} catalog`}
            className="flex-1 overflow-y-auto panel-scroll p-1.5"
          >
            {visibleRows.length === 0 && (
              <p className="px-3 py-6 text-center text-[11px] text-[var(--muted)]">
                No match for “{query}”
              </p>
            )}
            {visibleRows.map((row, i) => {
              const header =
                showGroupHeaders && row.category !== lastGroup ? row.category : null
              lastGroup = row.category
              const Icon = categoryIcon(row.category)
              const on = i === selected
              return (
                <div key={`${row.category}:${row.type}`}>
                  {header && (
                    <h3 className="px-2.5 pb-0.5 pt-2 text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)] first:pt-1">
                      {header}
                    </h3>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    data-selected={on || undefined}
                    onClick={() => onPick(row.type)}
                    onMouseMove={() => {
                      if (!on) setSelected(i)
                    }}
                    className={`flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left
                                transition-colors ${
                                  on ? 'bg-[rgb(var(--accent-rgb)/0.16)]' : ''
                                }`}
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded ${
                        on
                          ? 'bg-[rgb(var(--accent-rgb)/0.22)] text-[var(--accent)]'
                          : 'bg-[var(--panel-3)] text-[var(--muted)]'
                      }`}
                    >
                      <Icon size={14} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-[var(--text)]">
                        {row.name}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--muted)]">
                        {row.description}
                      </span>
                    </span>
                    {on && (
                      <span className="flex-shrink-0 text-[10px] text-[var(--accent)]">
                        Enter ↵
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <footer className="flex items-center gap-3.5 border-t border-[var(--border)] px-4 py-1.5 text-[10px] text-[var(--muted)]">
          <span>
            <b className="font-semibold text-[var(--text)]">↑↓</b> navigate
          </span>
          <span>
            <b className="font-semibold text-[var(--text)]">Enter</b> select
          </span>
          <span>
            <b className="font-semibold text-[var(--text)]">Tab</b> category
          </span>
          <span className="ml-auto tabular-nums">
            {visibleRows.length} of {allRows.length}
          </span>
        </footer>
      </div>
    </dialog>
  )
}
