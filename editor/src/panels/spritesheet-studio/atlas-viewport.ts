// Sprite Studio atlas viewport zoom (local to modal; not editor canvas zoom).

export const SPRITE_STUDIO_ZOOM_MIN = 0.25
export const SPRITE_STUDIO_ZOOM_MAX = 16
export const SPRITE_STUDIO_ZOOM_DEFAULT = 1
export const SPRITE_STUDIO_VIEWPORT_PADDING_PX = 24

const SPRITE_STUDIO_ZOOM_PRESETS = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16,
] as const

const ZOOM_EPSILON = 0.001

export function clampSpriteStudioZoom(z: number): number {
  if (!Number.isFinite(z)) return SPRITE_STUDIO_ZOOM_DEFAULT
  return Math.min(SPRITE_STUDIO_ZOOM_MAX, Math.max(SPRITE_STUDIO_ZOOM_MIN, z))
}

export function computeSpriteStudioFitZoom(
  containerW: number,
  containerH: number,
  sheetW: number,
  sheetH: number,
  paddingPx: number = SPRITE_STUDIO_VIEWPORT_PADDING_PX,
): number {
  const availW = Math.max(1, containerW - paddingPx * 2)
  const availH = Math.max(1, containerH - paddingPx * 2)
  if (sheetW <= 0 || sheetH <= 0) return SPRITE_STUDIO_ZOOM_DEFAULT
  return clampSpriteStudioZoom(Math.min(availW / sheetW, availH / sheetH))
}

export function nextSpriteStudioZoomStep(current: number, dir: 1 | -1): number {
  if (dir > 0) {
    const next = SPRITE_STUDIO_ZOOM_PRESETS.find((z) => z > current + ZOOM_EPSILON)
    return clampSpriteStudioZoom(next ?? SPRITE_STUDIO_ZOOM_MAX)
  }
  for (let i = SPRITE_STUDIO_ZOOM_PRESETS.length - 1; i >= 0; i--) {
    if (SPRITE_STUDIO_ZOOM_PRESETS[i] < current - ZOOM_EPSILON) {
      return clampSpriteStudioZoom(SPRITE_STUDIO_ZOOM_PRESETS[i])
    }
  }
  return clampSpriteStudioZoom(SPRITE_STUDIO_ZOOM_PRESETS[0])
}

export function formatSpriteStudioZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
