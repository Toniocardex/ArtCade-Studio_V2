import { describe, expect, it } from 'vitest'
import {
  playStageAvailableSize,
  runtimeCanvasPlayStyle,
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

  it('builds docked and floating play styles from the same viewport contract', () => {
    const hostSize = { x: 1024, y: 640 }
    const docked = runtimeCanvasPlayStyle({
      hostSize,
      background: 'rgb(21, 23, 28)',
      layout: 'docked-top-left',
      pointerEvents: 'auto',
    })
    const floating = runtimeCanvasPlayStyle({
      hostSize,
      background: 'rgb(21, 23, 28)',
      layout: 'floating-centered',
    })

    expect(docked.width).toBe('1024px')
    expect(docked.transform).toBe('none')
    expect(floating.transform).toBe('translate(-50%, -50%)')
  })
})
