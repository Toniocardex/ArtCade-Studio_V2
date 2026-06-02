import { describe, it, expect } from 'vitest'
import { resolveLayoutTier } from './editor-layout-tier'

describe('resolveLayoutTier', () => {
  it('maps breakpoints', () => {
    expect(resolveLayoutTier(1920, 1080)).toBe('full')
    expect(resolveLayoutTier(1366, 768)).toBe('compact')
    expect(resolveLayoutTier(1280, 720)).toBe('compact')
    expect(resolveLayoutTier(1200, 700)).toBe('minimal')
    expect(resolveLayoutTier(1000, 700)).toBe('unsupported')
  })
})
