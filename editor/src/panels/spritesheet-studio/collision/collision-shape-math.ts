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
  shape: Pick<CollisionShapeDef, 'type' | 'offsetX' | 'offsetY' | 'width' | 'height' | 'points'>,
  frame: AnimationFrameRect,
  zoom: number,
): PixelRect {
  if (shape.type === 'circle') {
    const diameter = Math.max(4, shape.width * frame.w * zoom)
    return {
      x: (frame.x + shape.offsetX * frame.w) * zoom,
      y: (frame.y + shape.offsetY * frame.h) * zoom,
      w: diameter,
      h: diameter,
    }
  }
  if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
    const xs = shape.points.map(point => shape.offsetX + point.x)
    const ys = shape.points.map(point => shape.offsetY + point.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    return {
      x: (frame.x + minX * frame.w) * zoom,
      y: (frame.y + minY * frame.h) * zoom,
      w: Math.max(4, (maxX - minX) * frame.w * zoom),
      h: Math.max(4, (maxY - minY) * frame.h * zoom),
    }
  }
  return {
    x: (frame.x + shape.offsetX * frame.w) * zoom,
    y: (frame.y + shape.offsetY * frame.h) * zoom,
    w: Math.max(4, shape.width * frame.w * zoom),
    h: Math.max(4, shape.height * frame.h * zoom),
  }
}

export function polygonClipPath(
  shape: Pick<CollisionShapeDef, 'type' | 'offsetX' | 'offsetY' | 'points'>,
): string | undefined {
  if (shape.type !== 'polygon' || !shape.points || shape.points.length < 3) return undefined
  const xs = shape.points.map(point => shape.offsetX + point.x)
  const ys = shape.points.map(point => shape.offsetY + point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  const width = Math.max(0.0001, maxX - minX)
  const height = Math.max(0.0001, maxY - minY)
  const points = shape.points
    .map((point) => {
      const x = ((shape.offsetX + point.x - minX) / width) * 100
      const y = ((shape.offsetY + point.y - minY) / height) * 100
      return `${clampPercent(x)}% ${clampPercent(y)}%`
    })
    .join(', ')
  return `polygon(${points})`
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Number(value.toFixed(2))))
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

export function pixelRectToShapePatch(
  shape: Pick<CollisionShapeDef, 'type' | 'offsetX' | 'offsetY' | 'width' | 'height' | 'points'>,
  rect: PixelRect,
  frame: AnimationFrameRect,
  zoom: number,
): NormalizedRect & Partial<Pick<CollisionShapeDef, 'points' | 'radius'>> {
  const next = pixelRectToShape(rect, frame, zoom)
  if (shape.type === 'circle') {
    const diameter = Math.max(1, rect.w / Math.max(0.01, zoom))
    return {
      ...next,
      width: clamp01(diameter / Math.max(1, frame.w)),
      height: clamp01(diameter / Math.max(1, frame.h)),
      radius: diameter * 0.5,
    }
  }
  if (shape.type !== 'polygon' || !shape.points || shape.points.length < 3) {
    return { ...next, points: shape.points }
  }

  const absXs = shape.points.map(point => shape.offsetX + point.x)
  const absYs = shape.points.map(point => shape.offsetY + point.y)
  const minX = Math.min(...absXs)
  const minY = Math.min(...absYs)
  const maxX = Math.max(...absXs)
  const maxY = Math.max(...absYs)
  const oldW = Math.max(0.0001, maxX - minX)
  const oldH = Math.max(0.0001, maxY - minY)
  return {
    ...next,
    points: shape.points.map((point) => {
      const tx = (shape.offsetX + point.x - minX) / oldW
      const ty = (shape.offsetY + point.y - minY) / oldH
      return {
        x: clamp01(tx * next.width),
        y: clamp01(ty * next.height),
      }
    }),
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
