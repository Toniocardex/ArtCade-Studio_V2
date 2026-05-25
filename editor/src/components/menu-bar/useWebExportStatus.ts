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

export function mapWebExportToolbar(status: WebExportStatus) {
  return { exportState: status.state as 'missing' | 'stale' | 'ready' }
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
