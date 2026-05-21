// ---------------------------------------------------------------------------
// PreviewMetricsBadge — bottom-right summary of game / scene / viewport size
// ---------------------------------------------------------------------------

import type { SceneDef } from '../../types'

interface PreviewMetricsBadgeProps {
  outputSize: { x: number; y: number }
  scene:      SceneDef | undefined
}

export function PreviewMetricsBadge({ outputSize, scene }: PreviewMetricsBadgeProps) {
  return (
    <div className="absolute bottom-8 right-8 text-[9px] text-[var(--muted)]
                    bg-[var(--panel)] border border-[var(--border)] rounded px-1.5 py-0.5
                    select-none pointer-events-none text-right leading-tight">
      <div>Output {outputSize.x}x{outputSize.y}</div>
      {scene && (
        <>
          <div>Scene {scene.worldSize.x}x{scene.worldSize.y}</div>
          <div>Viewport {scene.viewportSize.x}x{scene.viewportSize.y}</div>
        </>
      )}
    </div>
  )
}
