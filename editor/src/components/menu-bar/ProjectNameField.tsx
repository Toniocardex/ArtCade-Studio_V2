import { PencilLine } from 'lucide-react'
import { applyInputBackspace, isBackspaceKey } from '../../utils/keyboard'

interface ProjectNameFieldProps {
  value: string
  committedName: string
  onChange: (value: string) => void
  onCommit: () => void
}

export function ProjectNameField({
  value,
  committedName,
  onChange,
  onCommit,
}: ProjectNameFieldProps) {
  return (
    <label
      className="ml-3 h-8 min-w-[180px] max-w-[320px] flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--panel-3)] px-2 text-[var(--muted)]"
      title="Project name"
    >
      <PencilLine size={12} className="shrink-0" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (isBackspaceKey(e)) {
            e.preventDefault()
            applyInputBackspace(e.currentTarget)
          } else if (e.key === 'Enter') {
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            onChange(committedName)
            e.currentTarget.blur()
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[var(--text)] outline-none"
        aria-label="Project name"
      />
    </label>
  )
}
