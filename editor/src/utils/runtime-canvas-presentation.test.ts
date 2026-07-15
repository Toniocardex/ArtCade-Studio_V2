import { describe, expect, it } from 'vitest'
import {
  playStageAvailableSize,
  runtimeCanvasEditVisual,
  runtimeCanvasPlayStyle,
  runtimeCanvasPlayVisual,
  sceneBackgroundCss,
} from './runtime-canvas-presentation'

describe('runtime-canvas-presentation', () => {
  it('computes available play stage area without deciding fit', () => {
    const available = playStageAvailableSize({ x: 1024, y: 768 })
    expect(available).toEqual({ x: 992, y: 736 })
  })

  it('formats scene background colours', () => {
    expect(sceneBackgroundCss({ x: 21 / 255, y: 23 / 255, z: 28 / 255, w: 1 }))
      .toBe('rgb(21, 23, 28)')
  })

  it('builds play visuals without owning geometry', () => {
    const visual = runtimeCanvasPlayVisual({
      background: 'rgb(21, 23, 28)',
      pointerEvents: 'auto',
    })
    expect(visual.background).toBe('rgb(21, 23, 28)')
    expect(visual.imageRendering).toBe('pixelated')
    expect(visual).not.toHaveProperty('width')
    expect(visual).not.toHaveProperty('left')
  })

  it('keeps deprecated play style width contract for callers', () => {
    const docked = runtimeCanvasPlayStyle({
      hostSize: { x: 1024, y: 640 },
      background: 'rgb(21, 23, 28)',
      layout: 'docked-top-left',
      pointerEvents: 'auto',
    })
    expect(docked.width).toBe('1024px')
    expect(docked.transform).toBe('none')
  })

  it('forces edit canvas visibility after play may have hidden it', () => {
    const style = runtimeCanvasEditVisual({
      background: '#050608',
    })
    expect(style.visibility).toBe('visible')
    expect(style.opacity).toBe('1')
  })
})
