import type { CollisionShapeDef } from '../../../types/components'
import type { AnimationFrameRect } from '../../../types'

export type NormalizedRect = Readonly<{
  offsetX: number
  offsetY: number
  width: number
  height: number
}>

export type PixelRect = Readonly<{
  x: number
  y: number
  w: number
  h: number
}>

export function referenceFrameRect(
  frame: AnimationFrameRect | null,
  sheetW: number,
  sheetH: number,
): AnimationFrameRect {
  if (frame && frame.w > 0 && frame.h > 0) return frame
  return { x: 0, y: 0, w: Math.max(1, sheetW), h: Math.max(1, sheetH) }
}

export function shapeToPixelRect(
  shape: Pick<CollisionShapeDef, 'offsetX' | 'offsetY' | 'width' | 'height'>,
  frame: AnimationFrameRect,
  zoom: number,
): PixelRect {
  return {
    x: (frame.x + shape.offsetX * frame.w) * zoom,
    y: (frame.y + shape.offsetY * frame.h) * zoom,
    w: Math.max(4, shape.width * frame.w * zoom),
    h: Math.max(4, shape.height * frame.h * zoom),
  }
}

export function pixelRectToShape(
  rect: PixelRect,
  frame: AnimationFrameRect,
  zoom: number,
): NormalizedRect {
  const fx = frame.x
  const fy = frame.y
  const fw = Math.max(1, frame.w)
  const fh = Math.max(1, frame.h)
  const z = Math.max(0.01, zoom)
  const x = rect.x / z
  const y = rect.y / z
  const w = rect.w / z
  const h = rect.h / z
  return {
    offsetX: clamp01((x - fx) / fw),
    offsetY: clamp01((y - fy) / fh),
    width: clamp01(w / fw),
    height: clamp01(h / fh),
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export const ROLE_COLORS: Record<CollisionShapeDef['role'], string> = {
  body: '#38bdf8',
  feet: '#22c55e',
  hurtbox: '#f97316',
  hitbox: '#ef4444',
  interaction: '#14b8a6',
}
