// ---------------------------------------------------------------------------
// ProjectHealthBanner — validation summary above the preview canvas
// ---------------------------------------------------------------------------

import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'
import { useEditor } from '../../store/editor-store'
import { getProjectWorkbenchSnapshot } from '../../utils/project-health'

interface ProjectHealthBannerProps {
  projectKey: string | null
}

export function ProjectHealthBanner({ projectKey }: ProjectHealthBannerProps) {
  const { state, dispatch } = useEditor()
  const health = useMemo(
    () => getProjectWorkbenchSnapshot({
      project: state.project,
      projectPath: projectKey,
      openScripts: state.openScripts,
      includeCompile: true,
    }).health,
    [state.project, state.openScripts, projectKey],
  )

  if (health.errors.length === 0 && health.warnings.length === 0) return null

  const blocking = health.errors.length > 0
  const summary = blocking
    ? `${health.errors.length} error(s) block Play`
  : `${health.warnings.length} warning(s)`

  return (
    <button
      type="button"
      onClick={() => dispatch({ type: 'SET_CONSOLE_OPEN', open: true })}
      title="Open console for full validation details"
      className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-semibold
                  tracking-wide uppercase transition-colors ${
                    blocking
                      ? 'border-[var(--danger)]/50 bg-[rgb(var(--danger-rgb)/0.12)] text-[var(--danger)]'
                      : 'border-[var(--warn)]/50 bg-[rgb(var(--warn-rgb)/0.1)] text-[var(--warn)]'
                  }`}
    >
      <AlertTriangle size={11} />
      <span>{summary}</span>
    </button>
  )
}
