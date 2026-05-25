import { useEffect, useState } from 'react'
import { PencilLine } from 'lucide-react'
import { safeProjectFolderName } from '../../utils/project'
import type { ProjectDoc } from '../../types'

interface ProjectNameFieldProps {
  project: ProjectDoc
  onRename: (name: string) => void
}

export function ProjectNameField({ project, onRename }: ProjectNameFieldProps) {
  const [draft, setDraft] = useState(project.projectName)

  useEffect(() => {
    setDraft(project.projectName)
  }, [project.projectName])

  function commitDraft() {
    const nextName = safeProjectFolderName(draft, 'Untitled')
    setDraft(nextName)
    onRename(nextName)
  }

  return (
    <label
      className="ml-3 h-8 min-w-[180px] max-w-[320px] flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--panel-3)] px-2 text-[var(--muted)]"
      title="Project name"
    >
      <PencilLine size={12} className="shrink-0" />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setDraft(project.projectName)
            e.currentTarget.blur()
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[var(--text)] outline-none"
        aria-label="Project name"
      />
    </label>
  )
}
