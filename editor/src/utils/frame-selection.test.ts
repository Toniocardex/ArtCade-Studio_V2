import { describe, it, expect } from 'vitest'
import { computeFrameSelectionView, FRAME_SELECTION_SPAN } from './frame-selection'
import { computeFitZoom } from './editor-zoom'

describe('computeFrameSelectionView', () => {
  it('centres on the entity position', () => {
    const view = computeFrameSelectionView({
      position: { x: 240, y: 130 },
      clientW: 1000,
      clientH: 800,
      paddingPx: 16,
    })
    expect(view.center).toEqual({ x: 240, y: 130 })
  })

  it('frames the default span at scale 1', () => {
    const view = computeFrameSelectionView({
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      clientW: 1000,
      clientH: 800,
      paddingPx: 16,
    })
    const expected = computeFitZoom(1000, 800, FRAME_SELECTION_SPAN, FRAME_SELECTION_SPAN, 16)
    expect(view.zoom).toBeCloseTo(expected, 5)
  })

  it('widens the framed span by the entity scale (zooms out for a stretched object)', () => {
    const small = computeFrameSelectionView({
      position: { x: 0, y: 0 }, scale: { x: 1, y: 1 },
      clientW: 1000, clientH: 800, paddingPx: 16,
    })
    const wide = computeFrameSelectionView({
      position: { x: 0, y: 0 }, scale: { x: 4, y: 1 },
      clientW: 1000, clientH: 800, paddingPx: 16,
    })
    expect(wide.zoom).toBeLessThan(small.zoom)
  })

  it('clamps an extreme scale so the zoom never collapses to the minimum', () => {
    const huge = computeFrameSelectionView({
      position: { x: 0, y: 0 }, scale: { x: 1000, y: 1000 },
      clientW: 1000, clientH: 800, paddingPx: 16,
    })
    // factor is capped at 8 → span 2560, not 320000.
    const capped = computeFitZoom(1000, 800, FRAME_SELECTION_SPAN * 8, FRAME_SELECTION_SPAN * 8, 16)
    expect(huge.zoom).toBeCloseTo(capped, 5)
  })
})
