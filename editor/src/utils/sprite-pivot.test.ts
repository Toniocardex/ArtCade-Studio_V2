import { describe, it, expect } from 'vitest'
import {
  clampPivot,
  pivotsEqual,
  formatPivotLabel,
  activePresetId,
  PIVOT_PRESETS,
} from './sprite-pivot'

describe('sprite-pivot', () => {
  it('clampPivot keeps values in 0..1', () => {
    expect(clampPivot({ x: -0.2, y: 1.5 })).toEqual({ x: 0, y: 1 })
  })

  it('pivotsEqual matches presets within epsilon', () => {
    expect(pivotsEqual({ x: 0.5, y: 0.5 }, { x: 0.5005, y: 0.4995 })).toBe(true)
    expect(pivotsEqual({ x: 0, y: 0 }, { x: 0.5, y: 0.5 })).toBe(false)
  })

  it('formatPivotLabel uses preset name when exact', () => {
    expect(formatPivotLabel({ x: 0.5, y: 1 })).toBe('Bottom-center')
    expect(formatPivotLabel({ x: 0.33, y: 0.66 })).toBe('0.33, 0.66')
  })

  it('activePresetId resolves known presets', () => {
    expect(activePresetId({ x: 0.5, y: 0.5 })).toBe('c')
    expect(activePresetId({ x: 0.33, y: 0.66 })).toBeNull()
  })

  it('defines nine anchor presets', () => {
    expect(PIVOT_PRESETS).toHaveLength(9)
  })
})
