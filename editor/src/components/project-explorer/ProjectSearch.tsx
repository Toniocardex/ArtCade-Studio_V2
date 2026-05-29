import { Search } from 'lucide-react'

export type ProjectSearchProps = Readonly<{
  value: string
  onChange: (value: string) => void
}>

export function ProjectSearch({ value, onChange }: ProjectSearchProps) {
  return (
    <div className="p-2 border-b border-[var(--border)] flex-shrink-0">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search..."
          aria-label="Search project tree"
          className="w-full bg-[var(--bg)] border border-[var(--border-2)] rounded pl-7 pr-2 py-1.5
                     text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
    </div>
  )
}
