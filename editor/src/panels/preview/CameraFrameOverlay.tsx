import { useRef } from 'react'
import { Move } from 'lucide-react'
import type { Vec2 } from '../../types'

export type CameraFrameOverlayProps = Readonly<{
  viewportSize: Vec2
  zoom: number
  /** When the scene frame is already clipped to the viewport (camera preview). */
  fillFrame?: boolean
  worldSize?: Vec2
  /** Top-left world position of the editor camera (fixed surface). */
  cameraWorldOrigin?: Vec2
  /** Top-left world position of the camera's initial view. Defaults to (0,0). */
  cameraStart?: Vec2
  /**
   * When provided, the label becomes a drag handle: dragging it reports the new
   * top-left world position of the initial camera view. The caller clamps and
   * persists it. Omit it (or in camera-preview) to render a static marker.
   */
  onCameraStartDrag?: (world: Vec2) => void
}>

/** Neutral scrim dimming the in-scene area the camera does NOT show at start. */
const LETTERBOX_SCRIM = 'rgb(0 0 0 / 0.6)'

/**
 * Camera rectangle + scene-aware letterbox (edit-mode affordance).
 *
 * The dashed rectangle marks the slice of the world the player sees at the
 * scene's initial camera position. A large spread box-shadow dims everything
 * around it; the `.canvas-scene-frame` parent has `overflow: hidden`, so the
 * scrim is clipped to the scene bounds — only the off-camera part of the scene
 * is darkened, making the play area read as the focal point. When the scene is
 * no larger than the viewport there is nothing off-camera, so we render nothing.
 *
 * The label doubles as a move handle (see `onCameraStartDrag`); the rest of the
 * rectangle stays click-through so entities under it remain selectable.
 */
export function CameraFrameOverlay({
  worldSize,
  viewportSize,
  zoom,
  fillFrame = false,
  cameraWorldOrigin,
  cameraStart,
  onCameraStartDrag,
}: CameraFrameOverlayProps) {
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null)

  if (viewportSize.x <= 0 || viewportSize.y <= 0) return null
  if (
    !fillFrame
    && worldSize
    && (viewportSize.x >= worldSize.x || viewportSize.y >= worldSize.y)
  ) {
    return null
  }

  const camX = cameraWorldOrigin?.x ?? 0
  const camY = cameraWorldOrigin?.y ?? 0
  const startX = cameraStart?.x ?? 0
  const startY = cameraStart?.y ?? 0
  const z = zoom > 0 ? zoom : 1
  const left = Math.round((startX - camX) * z)
  const top  = Math.round((startY - camY) * z)
  const w = Math.round(viewportSize.x * z)
  const h = Math.round(viewportSize.y * z)

  const draggable = !!onCameraStartDrag && !fillFrame

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onCameraStartDrag) return
    e.preventDefault()
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture unsupported */ }
    dragRef.current = { startX: e.clientX, startY: e.clientY, camX: startX, camY: startY }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || !onCameraStartDrag) return
    const z = zoom > 0 ? zoom : 1
    onCameraStartDrag({
      x: d.camX + (e.clientX - d.startX) / z,
      y: d.camY + (e.clientY - d.startY) / z,
    })
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { /* not captured */ }
    dragRef.current = null
  }

  return (
    <div className="absolute inset-0 z-[6] pointer-events-none">
      <div
        className="absolute"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${w}px`,
          height: `${h}px`,
          boxShadow: fillFrame ? undefined : `0 0 0 9999px ${LETTERBOX_SCRIM}`,
        }}
        aria-hidden={false}
        role="img"
        aria-label={`Camera view ${viewportSize.x} by ${viewportSize.y}`}
      >
        <div
          className="absolute inset-0 border border-dashed"
          style={{ borderColor: 'var(--camera-frame)' }}
        />
        <div
          className="absolute top-0 left-0 flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold
                     uppercase tracking-wide select-none bg-[var(--surface)]/90 text-[var(--primary-soft)]
                     border border-[var(--outline-subtle)] border-t-0 border-l-0"
          style={draggable ? { pointerEvents: 'auto', cursor: 'move', touchAction: 'none' } : undefined}
          title={draggable ? 'Drag to set the initial camera position' : undefined}
          onPointerDown={draggable ? onPointerDown : undefined}
          onPointerMove={draggable ? onPointerMove : undefined}
          onPointerUp={draggable ? onPointerUp : undefined}
          onPointerCancel={draggable ? onPointerUp : undefined}
        >
          {draggable && <Move className="h-2.5 w-2.5 shrink-0" aria-hidden />}
          Camera View · {viewportSize.x}×{viewportSize.y}
        </div>
      </div>
    </div>
  )
}
