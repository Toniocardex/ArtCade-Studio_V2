import { useCallback, useRef, type PointerEvent } from 'react'
import type { CollisionProfileDef } from '../../../types'
import type { AnimationFrameRect } from '../../../types'
import {
  pixelRectToShape,
  referenceFrameRect,
  ROLE_COLORS,
  shapeToPixelRect,
  type PixelRect,
} from './collision-shape-math'
import { patchCollisionProfileShape } from '../../../utils/collision-profile'

type CollisionShapeOverlayProps = Readonly<{
  profile: CollisionProfileDef
  activeShapeIndex: number
  frameRect: AnimationFrameRect | null
  sheetW: number
  sheetH: number
  zoom: number
  onPatchProfile: (profile: CollisionProfileDef) => void
}>

type DragMode = 'move' | 'resize-se'

export function CollisionShapeOverlay({
  profile,
  activeShapeIndex,
  frameRect,
  sheetW,
  sheetH,
  zoom,
  onPatchProfile,
}: CollisionShapeOverlayProps) {
  const dragRef = useRef<{
    mode: DragMode
    startRect: PixelRect
    pointerStartX: number
    pointerStartY: number
  } | null>(null)

  const frame = referenceFrameRect(frameRect, sheetW, sheetH)
  const shapes = profile.shapes ?? []

  const commitRect = useCallback((rect: PixelRect) => {
    const shape = shapes[activeShapeIndex]
    if (!shape) return
    const normalized = pixelRectToShape(rect, frame, zoom)
    onPatchProfile(patchCollisionProfileShape(profile, activeShapeIndex, normalized))
  }, [activeShapeIndex, frame, onPatchProfile, profile, shapes, zoom])

  const onPointerDown = (mode: DragMode, rect: PixelRect) => (e: PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = {
      mode,
      startRect: rect,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.pointerStartX
    const dy = e.clientY - drag.pointerStartY
    if (drag.mode === 'move') {
      commitRect({
        x: drag.startRect.x + dx,
        y: drag.startRect.y + dy,
        w: drag.startRect.w,
        h: drag.startRect.h,
      })
    } else {
      commitRect({
        x: drag.startRect.x,
        y: drag.startRect.y,
        w: Math.max(8, drag.startRect.w + dx),
        h: Math.max(8, drag.startRect.h + dy),
      })
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {shapes.map((shape, index) => {
        if (!shape.enabled) return null
        const rect = shapeToPixelRect(shape, frame, zoom)
        const color = ROLE_COLORS[shape.role] ?? '#38bdf8'
        const isActive = index === activeShapeIndex
        return (
          <div
            key={`collision-shape-${index}`}
            className="absolute pointer-events-auto"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              border: `2px solid ${color}`,
              background: isActive ? `${color}33` : `${color}1a`,
              boxShadow: isActive ? `0 0 0 1px ${color}` : undefined,
            }}
            onPointerDown={onPointerDown('move', rect)}
          >
            {isActive && (
              <div
                className="absolute right-0 bottom-0 w-3 h-3 translate-x-1/2 translate-y-1/2 rounded-sm cursor-se-resize"
                style={{ background: color }}
                onPointerDown={onPointerDown('resize-se', rect)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
