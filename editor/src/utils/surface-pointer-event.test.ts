import { describe, expect, it, vi, beforeEach } from 'vitest'
import { captureSurfacePointerEvent } from './surface-pointer-event'
import * as presentationStore from './presentation-store'

describe('surface-pointer-event', () => {
  beforeEach(() => {
    vi.spyOn(presentationStore, 'getPresentationSnapshot').mockReturnValue({
      revision: 99n,
      effectiveMode: 'sceneEdit',
      letterboxActive: false,
      logical: { width: 800, height: 600 },
      editorViewOrigin: { x: 0, y: 0 },
      surfacePixelsPerWorldUnit: 1,
      visibleWorldBounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
    })
  })

  it('captures CSS-local position and presentation revision', () => {
    const el = {
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    } as HTMLElement

    const event = captureSurfacePointerEvent(el, 110, 220)
    expect(event.positionCss).toEqual({ x: 100, y: 200 })
    expect(event.presentationRevision).toBe(99n)
  })

  it('uses revision 0 when no snapshot is committed', () => {
    vi.spyOn(presentationStore, 'getPresentationSnapshot').mockReturnValue(null)
    const el = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as HTMLElement

    expect(captureSurfacePointerEvent(el, 5, 5).presentationRevision).toBe(0n)
  })
})
