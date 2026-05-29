import { describe, expect, it } from 'vitest'
import {
  clampSpriteStudioZoom,
  computeSpriteStudioFitZoom,
  nextSpriteStudioZoomStep,
  SPRITE_STUDIO_ZOOM_MAX,
  SPRITE_STUDIO_ZOOM_MIN,
} from './atlas-viewport'

describe('atlas-viewport', () => {
  it('clampSpriteStudioZoom bounds zoom', () => {
    expect(clampSpriteStudioZoom(0.01)).toBe(SPRITE_STUDIO_ZOOM_MIN)
    expect(clampSpriteStudioZoom(100)).toBe(SPRITE_STUDIO_ZOOM_MAX)
    expect(clampSpriteStudioZoom(2)).toBe(2)
  })

  it('computeSpriteStudioFitZoom scales small sheets into container', () => {
    const z = computeSpriteStudioFitZoom(400, 300, 64, 32, 24)
    expect(z).toBeGreaterThan(1)
    expect(z).toBeLessThanOrEqual(SPRITE_STUDIO_ZOOM_MAX)
  })

  it('nextSpriteStudioZoomStep moves along presets', () => {
    expect(nextSpriteStudioZoomStep(1, 1)).toBe(1.25)
    expect(nextSpriteStudioZoomStep(1.25, -1)).toBe(1)
  })
})
