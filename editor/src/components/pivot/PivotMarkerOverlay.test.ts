import { describe, expect, it } from 'vitest'
import { pivotOffsetInRect } from './PivotMarkerOverlay'

describe('pivotOffsetInRect', () => {
  it('maps normalized pivot to pixel offset', () => {
    expect(pivotOffsetInRect({ x: 0.5, y: 1 }, 32, 32)).toEqual({ left: 16, top: 32 })
    expect(pivotOffsetInRect({ x: 0, y: 0 }, 16, 16)).toEqual({ left: 0, top: 0 })
  })
})
