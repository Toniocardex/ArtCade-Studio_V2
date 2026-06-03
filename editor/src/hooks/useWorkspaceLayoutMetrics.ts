// ---------------------------------------------------------------------------
// useWorkspaceLayoutMetrics - window tier + workspace resize metrics
// ---------------------------------------------------------------------------

import { useEffect, useState, type RefObject } from 'react'
import { resolveLayoutTier, type LayoutTier } from '../utils/editor-layout-tier'

export type WorkspaceLayoutMetrics = {
  /** Window bucket used for breakpoints and per-resolution persistence. */
  width: number
  height: number
  /** Actual workbench body area used for panel clamp math. */
  workspaceWidth: number
  workspaceHeight: number
  tier: LayoutTier
}

const BOOT_METRICS: WorkspaceLayoutMetrics = {
  width: 1920,
  height: 1080,
  workspaceWidth: 1920,
  workspaceHeight: 1080,
  tier: 'full',
}

function readWindowSize(): { width: number; height: number } {
  if (globalThis.window === undefined) {
    return { width: 1920, height: 1080 }
  }
  return {
    width: Math.round(globalThis.innerWidth),
    height: Math.round(globalThis.innerHeight),
  }
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
      const windowSize = readWindowSize()
      setMetrics({
        ...windowSize,
        workspaceWidth: Math.round(rect.width),
        workspaceHeight: Math.round(rect.height),
        tier: resolveLayoutTier(windowSize.width, windowSize.height),
      })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    globalThis.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      globalThis.removeEventListener('resize', update)
    }
  }, [workspaceRef])

  return metrics
}
