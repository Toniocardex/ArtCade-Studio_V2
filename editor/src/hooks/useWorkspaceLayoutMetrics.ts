// ---------------------------------------------------------------------------
// useWorkspaceLayoutMetrics — single ResizeObserver for tier + layout bucket
// ---------------------------------------------------------------------------

import { useEffect, useState, type RefObject } from 'react'
import { resolveLayoutTier, type LayoutTier } from '../utils/editor-layout-tier'

export type WorkspaceLayoutMetrics = {
  width: number
  height: number
  tier: LayoutTier
}

const BOOT_METRICS: WorkspaceLayoutMetrics = {
  width: 1920,
  height: 1080,
  tier: 'full',
}

export function useWorkspaceLayoutMetrics(
  workspaceRef: RefObject<HTMLElement | null>,
): WorkspaceLayoutMetrics {
  const [metrics, setMetrics] = useState<WorkspaceLayoutMetrics>(BOOT_METRICS)

  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      setMetrics({
        width,
        height,
        tier: resolveLayoutTier(width, height),
      })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [workspaceRef])

  return metrics
}
