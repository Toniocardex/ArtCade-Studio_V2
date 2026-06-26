import { describe, expect, it } from 'vitest'
import {
  buildEditorRulerMetrics,
  pickRulerTickStep,
  rulerLabelsForCameraAxis,
} from './editor-ruler-metrics'

const WORLD = { x: 1280, y: 640 }

describe('pickRulerTickStep', () => {
  it('keeps 64px world step at 100% zoom', () => {
    expect(pickRulerTickStep(1)).toBe(64)
  })

  it('doubles step when ticks would be narrower than 24px on screen', () => {
    expect(pickRulerTickStep(0.25)).toBe(128)
  })
})

describe('buildEditorRulerMetrics', () => {
  it('reads zoom and bounds from the presentation snapshot', () => {
    const metrics = buildEditorRulerMetrics({
      presentationSnapshot: {
        revision: 1n,
        effectiveMode: 'sceneEdit',
        letterboxActive: false,
        logical: { width: 800, height: 600 },
        editorViewOrigin: { x: 0, y: 0 },
        surfacePixelsPerWorldUnit: 2,
        visibleWorldBounds: { minX: 0, minY: 0, maxX: 400, maxY: 300 },
      },
      fallbackZoom: 1,
      rulerStep: 64,
      worldSize: WORLD,
    })
    expect(metrics.zoom).toBe(2)
    expect(metrics.worldMaxX).toBe(400)
    expect(metrics.paddingPx).toBe(8)
  })

  it('falls back when snapshot is null', () => {
    const metrics = buildEditorRulerMetrics({
      presentationSnapshot: null,
      fallbackZoom: 1.5,
      rulerStep: 64,
      worldSize: WORLD,
    })
    expect(metrics.zoom).toBe(1.5)
    expect(metrics.worldMaxX).toBe(WORLD.x)
  })
})

describe('rulerLabelsForCameraAxis', () => {
  it('places world zero at surface origin when camera is at world zero', () => {
    const metrics = buildEditorRulerMetrics({
      presentationSnapshot: null,
      fallbackZoom: 2,
      rulerStep: 64,
      worldSize: WORLD,
    })
    const ticks = rulerLabelsForCameraAxis('x', { x: 0, y: 0 }, 400, metrics)
    const atZero = ticks.find(t => t.worldValue === 0)!
    expect(atZero.positionPx).toBe(0)
  })

  it('offsets ticks when the editor camera pans', () => {
    const metrics = buildEditorRulerMetrics({
      presentationSnapshot: null,
      fallbackZoom: 1,
      rulerStep: 64,
      worldSize: WORLD,
    })
    const ticks = rulerLabelsForCameraAxis('x', { x: 64, y: 0 }, 800, metrics)
    const at64 = ticks.find(t => t.worldValue === 64)!
    expect(at64.positionPx).toBe(0)
  })
})
