import { describe, expect, it } from 'vitest'
import {
  clampPreviewDisplayScale,
  CLIP_PREVIEW_MAX_CSS,
  previewDisplayScale,
} from './SpritesheetEnginePreview'

describe('previewDisplayScale', () => {
  it('scales small frames up for readable preview', () => {
    expect(previewDisplayScale(16, 16)).toBe(10)
    expect(previewDisplayScale(32, 32)).toBe(5)
  })

  it('caps scale for large frames', () => {
    expect(previewDisplayScale(128, 64)).toBe(3)
  })
})

describe('clampPreviewDisplayScale', () => {
  it('fits scaled canvas inside the clips column host', () => {
    const canvasW = 32
    const canvasH = 32
    const raw = previewDisplayScale(16, 16)
    const clamped = clampPreviewDisplayScale(canvasW, canvasH, raw, CLIP_PREVIEW_MAX_CSS)
    expect(canvasW * clamped).toBeLessThanOrEqual(CLIP_PREVIEW_MAX_CSS)
    expect(clamped).toBeLessThan(raw)
  })
})
