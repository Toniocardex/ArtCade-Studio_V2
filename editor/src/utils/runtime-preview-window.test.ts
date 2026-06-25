// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { calculateRuntimePreviewWindowSize } from './runtime-preview-window'

describe('calculateRuntimePreviewWindowSize', () => {
  it('uses the largest integer scale within the available screen area', () => {
    expect(calculateRuntimePreviewWindowSize(
      { x: 320, y: 240 },
      { x: 1920, y: 1080 },
    )).toEqual({ x: 960, y: 720 })
  })

  it('falls back to 1x when the logical resolution is larger than the screen budget', () => {
    expect(calculateRuntimePreviewWindowSize(
      { x: 1920, y: 1080 },
      { x: 1366, y: 768 },
    )).toEqual({ x: 1920, y: 1080 })
  })
})
