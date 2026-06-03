import { describe, it, expect } from 'vitest'
import { computeCanvasViewportLayout } from './canvas-viewport-layout'
import { computeVisibleWorldCenter } from './editor-viewport-center'

describe('computeVisibleWorldCenter', () => {
  it('maps scroll viewport centre to world coordinates', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: { x: 1280, y: 640 },
      viewportSize: { x: 512, y: 320 },
      zoom: 2,
      preview: false,
    })
    expect(computeVisibleWorldCenter(8, 8, 400, 300, layout)).toEqual({ x: 100, y: 75 })
  })

  it('uses layout zoom when zoom is zero in layout params', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: { x: 1280, y: 640 },
      viewportSize: { x: 512, y: 320 },
      zoom: 0,
      preview: false,
    })
    expect(computeVisibleWorldCenter(8, 8, 800, 600, layout)).toEqual({ x: 400, y: 300 })
  })
})
