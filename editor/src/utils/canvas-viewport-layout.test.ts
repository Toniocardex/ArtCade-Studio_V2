import { describe, it, expect } from 'vitest'
import {
  computeCanvasViewportLayout,
  edgeOffsetPx,
  pickRulerTickStep,
  rulerLabelsForAxis,
  scrollContentSizePx,
  scrollForFrameOrigin,
  scrollToWorld,
  worldToScroll,
} from './canvas-viewport-layout'

const WORLD = { x: 1280, y: 640 }
const VP = { x: 512, y: 320 }

describe('computeCanvasViewportLayout', () => {
  it('uses full world frame when not in preview', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 1,
      preview: false,
    })
    expect(layout.contentSizePx).toEqual({ x: 1280, y: 640 })
    expect(layout.contentOffsetPx).toEqual({ x: 8, y: 8 })
    expect(layout.worldOriginOffset).toEqual({ x: 0, y: 0 })
    expect(scrollContentSizePx(layout)).toEqual({ x: 1296, y: 656 })
  })

  it('clips frame to viewport in camera preview', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 2,
      preview: true,
    })
    expect(layout.contentSizePx).toEqual({ x: 1024, y: 640 })
    expect(layout.worldOriginOffset).toEqual({ x: 0, y: 0 })
  })

  it('centres the frame when the viewport is larger than the scene', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 1,
      preview: false,
      clientSize: { x: 2000, y: 1000 },
    })
    expect(layout.contentOffsetPx).toEqual({ x: 360, y: 180 })
    // Content + even margins exactly fill the viewport — no scrollbars.
    expect(scrollContentSizePx(layout)).toEqual({ x: 2000, y: 1000 })
  })

  it('centres a 4:3 world frame when the panel is taller than the scene', () => {
    const world = { x: 512, y: 384 }
    const layout = computeCanvasViewportLayout({
      worldSize: world,
      viewportSize: { x: 512, y: 320 },
      zoom: 1,
      preview: false,
      clientSize: { x: 900, y: 600 },
    })
    expect(layout.contentOffsetPx.y).toBe(Math.round((600 - 384) / 2))
    const anchor = scrollForFrameOrigin(layout)
    expect(scrollToWorld(anchor.scrollLeft, anchor.scrollTop, layout)).toEqual({ x: 0, y: 0 })
  })

  it('adds overscroll headroom when the scene overflows the viewport', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 1,
      preview: false,
      clientSize: { x: 800, y: 500 },
      overscrollPx: 100,
    })
    // basePad (8) + overscroll (100) on each overflowing edge.
    expect(layout.contentOffsetPx).toEqual({ x: 108, y: 108 })
    expect(scrollContentSizePx(layout)).toEqual({ x: 1280 + 216, y: 640 + 216 })
  })
})

describe('edgeOffsetPx', () => {
  it('falls back to basePad when the client size is unknown', () => {
    expect(edgeOffsetPx(undefined, 1280, 8, 100)).toBe(8)
    expect(edgeOffsetPx(0, 1280, 8, 100)).toBe(8)
  })

  it('centres (even margin) when the frame fits with room to spare', () => {
    expect(edgeOffsetPx(2000, 1280, 8, 100)).toBe(360)
  })

  it('uses basePad + overscroll when the frame overflows', () => {
    expect(edgeOffsetPx(800, 1280, 8, 100)).toBe(108)
  })
})

describe('pickRulerTickStep', () => {
  it('keeps 64px world step at 100% zoom', () => {
    expect(pickRulerTickStep(1)).toBe(64)
  })

  it('doubles step when ticks would be narrower than 24px on screen', () => {
    expect(pickRulerTickStep(0.25)).toBe(128)
  })
})

describe('scrollToWorld / worldToScroll', () => {
  it('maps scroll origin to world origin at frame corner', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 1,
      preview: false,
    })
    expect(scrollToWorld(8, 8, layout)).toEqual({ x: 0, y: 0 })
    expect(worldToScroll({ x: 0, y: 0 }, layout)).toEqual({ scrollLeft: 8, scrollTop: 8 })
  })

  it('keeps camera preview anchored to the initial runtime view at world origin', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 1,
      preview: true,
    })
    expect(scrollToWorld(8, 8, layout)).toEqual({ x: 0, y: 0 })
    expect(worldToScroll({ x: 0, y: 0 }, layout)).toEqual({ scrollLeft: 8, scrollTop: 8 })
  })

  it('maps viewport centre to world centre when scroll aligns with padding', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 2,
      preview: false,
    })
    expect(scrollToWorld(8, 8, layout, { x: 400, y: 300 })).toEqual({ x: 200, y: 150 })
  })
})

describe('rulerLabelsForAxis', () => {
  it('places world 0 at padding when scroll is zero', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 1,
      preview: false,
    })
    const ticks = rulerLabelsForAxis('x', 0, 800, layout)
    const zero = ticks.find(t => t.worldValue === 0)
    expect(zero?.positionPx).toBe(8)
  })

  it('labels absolute world coords in camera preview', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 1,
      preview: true,
    })
    const ticks = rulerLabelsForAxis('x', 0, 800, layout)
    expect(ticks.some(t => t.worldValue === 0)).toBe(true)
    const atZero = ticks.find(t => t.worldValue === 0)!
    expect(atZero.positionPx).toBe(8)
  })

  it('shifts tick positions when scrolled', () => {
    const layout = computeCanvasViewportLayout({
      worldSize: WORLD,
      viewportSize: VP,
      zoom: 1,
      preview: false,
    })
    const ticks = rulerLabelsForAxis('x', 64, 800, layout)
    const at64 = ticks.find(t => t.worldValue === 64)!
    expect(at64.positionPx).toBe(8)
  })
})
