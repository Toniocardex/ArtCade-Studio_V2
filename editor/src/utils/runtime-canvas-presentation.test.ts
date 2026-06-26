import { describe, expect, it } from 'vitest'
import {
  playCssScaleFromSnapshot,
  playDisplaySize,
  playFitScale,
  playStageAvailableSize,
  runtimeCanvasPlayStyle,
  sceneBackgroundCss,
} from './runtime-canvas-presentation'
import type { PresentationSnapshot } from './presentation-snapshot'

const SNAPSHOT: PresentationSnapshot = {
  revision: 3n,
  effectiveMode: 'playEmbedded',
  letterboxActive: false,
  useIdentityPlacement: false,
  surfaceFramebuffer: { width: 512, height: 320 },
  logical: { width: 512, height: 320 },
  placement: {
    destX: 0,
    destY: 0,
    destW: 512,
    destH: 320,
    scaleX: 2,
    scaleY: 2,
  },
  presentationScale: 2,
}

describe('runtime-canvas-presentation', () => {
  it('fits a logical viewport with integer upscale for floating preview', () => {
    expect(playFitScale(
      { x: 512, y: 320 },
      { x: 1024, y: 768 },
      { integerUpscale: true },
    )).toBe(2)
    expect(playDisplaySize({ x: 512, y: 320 }, 2)).toEqual({ x: 1024, y: 640 })
  })

  it('allows fractional fit scale for docked play stage', () => {
    const available = playStageAvailableSize({ x: 1024, y: 768 })
    expect(available).toEqual({ x: 992, y: 736 })
    expect(playFitScale(
      { x: 512, y: 320 },
      available,
      { minScale: 0.1 },
    )).toBeCloseTo(1.9375, 4)
  })

  it('derives play CSS scale from committed snapshot logical size', () => {
    const scale = playCssScaleFromSnapshot(
      SNAPSHOT,
      { x: 1024, y: 768 },
      { integerUpscale: true },
    )
    expect(scale).toBe(2)
  })

  it('formats scene background colours', () => {
    expect(sceneBackgroundCss({ x: 21 / 255, y: 23 / 255, z: 28 / 255, w: 1 }))
      .toBe('rgb(21, 23, 28)')
  })

  it('builds docked and floating play styles from the same viewport contract', () => {
    const viewport = { x: 512, y: 320 }
    const docked = runtimeCanvasPlayStyle({
      viewport,
      scale: 2,
      background: 'rgb(21, 23, 28)',
      layout: 'docked-top-left',
      pointerEvents: 'auto',
    })
    const floating = runtimeCanvasPlayStyle({
      viewport,
      scale: 2,
      background: 'rgb(21, 23, 28)',
      layout: 'floating-centered',
    })

    expect(docked.width).toBe('512px')
    expect(docked.transform).toBe('scale(2)')
    expect(floating.transform).toBe('translate(-50%, -50%) scale(2)')
  })
})
