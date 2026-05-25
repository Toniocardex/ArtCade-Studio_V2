import { useCallback, useEffect, useState } from 'react'
import {
  getWebExportStatus,
  type WebExportStatus,
} from '../../utils/api'
import { dirName } from '../../utils/project'

const MISSING_STATUS: WebExportStatus = {
  state: 'missing',
  distDir: '',
  hint: 'Run BUILD WEB first to create a browser export',
}

export function mapWebExportToolbar(
  status: WebExportStatus,
  hasProject: boolean,
  buildBusy: boolean,
) {
  const canOpenInBrowser = status.state === 'ready' && hasProject && !buildBusy

  let openDisabledReason: string | undefined
  if (!hasProject) {
    openDisabledReason = 'Load a project first'
  } else if (buildBusy) {
    openDisabledReason = 'Wait for the current build to finish'
  } else if (status.state !== 'ready') {
    openDisabledReason = status.hint
  }

  const exportStatusHint =
    status.state === 'ready'
      ? 'Export ready'
      : status.state === 'stale'
        ? 'Export outdated'
        : 'No export'

  const buildWebHint = status.state === 'stale' ? 'Refresh browser export' : undefined

  return { canOpenInBrowser, openDisabledReason, exportStatusHint, buildWebHint }
}

export function useWebExportStatus(
  projectPath: string | null,
  projectDirty: boolean,
  projectName: string | undefined,
) {
  const [status, setStatus] = useState<WebExportStatus>(MISSING_STATUS)

  const refreshWebExportStatus = useCallback(
    async (opts?: { projectDirty?: boolean }) => {
      if (!projectPath) {
        setStatus(MISSING_STATUS)
        return
      }
      const dirty = opts?.projectDirty ?? projectDirty
      try {
        const next = await getWebExportStatus(dirName(projectPath), dirty)
        setStatus(next)
      } catch {
        setStatus(MISSING_STATUS)
      }
    },
    [projectPath, projectDirty],
  )

  useEffect(() => {
    void refreshWebExportStatus()
  }, [refreshWebExportStatus, projectName])

  return { status, refreshWebExportStatus }
}
