import type { Vec2 } from '../../types'

export type CameraFrameOverlayProps = Readonly<{
  viewportSize: Vec2
  zoom: number
  /** When the scene frame is already clipped to the viewport (camera preview). */
  fillFrame?: boolean
  worldSize?: Vec2
}>

/** Dashed camera rectangle (edit mode affordance). */
export function CameraFrameOverlay({
  worldSize,
  viewportSize,
  zoom,
  fillFrame = false,
}: CameraFrameOverlayProps) {
  if (viewportSize.x <= 0 || viewportSize.y <= 0) return null
  if (
    !fillFrame
    && worldSize
    && (viewportSize.x >= worldSize.x || viewportSize.y >= worldSize.y)
  ) {
    return null
  }

  // Renderer camera coordinates use a top-left target: the initial play view
  // covers world (0,0) through viewportSize.
  const left = 0
  const top = 0
  const w = Math.round(viewportSize.x * zoom)
  const h = Math.round(viewportSize.y * zoom)

  return (
    <div
      className="absolute z-[2] pointer-events-none"
      style={{ left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` }}
      aria-hidden={false}
      role="img"
      aria-label={`Camera view ${viewportSize.x} by ${viewportSize.y}`}
    >
      <div
        className="absolute inset-0 border border-dashed"
        style={{ borderColor: 'var(--camera-frame)' }}
      />
      <div
        className="absolute top-0 left-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide
                   bg-[var(--surface)]/90 text-[var(--primary-soft)] border border-[var(--outline-subtle)]
                   border-t-0 border-l-0"
      >
        Camera View · {viewportSize.x}×{viewportSize.y}
      </div>
    </div>
  )
}
