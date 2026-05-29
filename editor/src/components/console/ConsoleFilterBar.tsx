import type { ReactNode } from 'react'
import { Search, XCircle, AlertTriangle, Info } from 'lucide-react'
import type { ConsoleLevelCounts, ConsoleLevelFilters, ConsoleFilterKey } from '../../utils/console-log-filters'

export type ConsoleFilterBarProps = Readonly<{
  filters: ConsoleLevelFilters
  counts: ConsoleLevelCounts
  searchActive?: boolean
  search: string
  onToggle: (key: ConsoleFilterKey) => void
  onSearchChange: (value: string) => void
}>

type ChipProps = Readonly<{
  active: boolean
  label: string
  count: number
  countTitle?: string
  icon: ReactNode
  tone: 'error' | 'warn' | 'info'
  onClick: () => void
}>

function FilterChip({ active, label, count, countTitle, icon, tone, onClick }: ChipProps) {
  const toneClass =
    tone === 'error'
      ? 'text-[var(--danger-2)]'
      : tone === 'warn'
        ? 'text-[var(--warn)]'
        : 'text-[var(--accent)]'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] transition-colors ${
        active
          ? 'bg-[var(--panel-2)] border-[var(--border-2)] text-[var(--text)]'
          : 'bg-transparent border-[var(--border)] text-[var(--muted)] opacity-60 hover:opacity-100'
      }`}
    >
      <span className={toneClass}>{icon}</span>
      <span>{label}</span>
      <span className="text-[var(--muted)] tabular-nums" title={countTitle}>
        {count}
      </span>
    </button>
  )
}

export function ConsoleFilterBar({
  filters,
  counts,
  searchActive = false,
  search,
  onToggle,
  onSearchChange,
}: ConsoleFilterBarProps) {
  const countTitle = searchActive
    ? 'Count for logs matching the search box'
    : 'Total count in the console buffer'

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--panel-2)]">
      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
        <FilterChip
          active={filters.error}
          label="Errors"
          count={counts.error}
          countTitle={countTitle}
          tone="error"
          icon={<XCircle size={12} fill="currentColor" />}
          onClick={() => onToggle('error')}
        />
        <FilterChip
          active={filters.warn}
          label="Warnings"
          count={counts.warn}
          countTitle={countTitle}
          tone="warn"
          icon={<AlertTriangle size={12} fill="currentColor" />}
          onClick={() => onToggle('warn')}
        />
        <FilterChip
          active={filters.info}
          label="Info"
          count={counts.info}
          countTitle={countTitle}
          tone="info"
          icon={<Info size={12} fill="currentColor" />}
          onClick={() => onToggle('info')}
        />
      </div>
      <div className="relative w-full sm:w-48 flex-shrink-0">
        <Search
          size={12}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search logs…"
          aria-label="Search console logs"
          className="w-full bg-[var(--bg)] border border-[var(--border-2)] rounded-full pl-7 pr-2 py-0.5
                     text-[10px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
    </div>
  )
}
