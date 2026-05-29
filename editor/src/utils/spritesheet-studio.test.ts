import { describe, expect, it } from 'vitest'
import {
  clampFrameRange,
  deriveGrid,
  frameAtCell,
  frameKey,
  frameRangeFromIndices,
  framesToSortedIndices,
  indicesRangeToFrames,
  indicesSetToFrames,
} from './spritesheet-studio'

describe('spritesheet-studio', () => {
  const grid = deriveGrid(128, 64, 32, 32)

  it('deriveGrid counts cols, rows, and total frames', () => {
    expect(grid).toEqual({ cols: 4, rows: 2, totalFrames: 8 })
  })

  it('frameKey is stable per rect', () => {
    const fr = frameAtCell(1, 0, 32, 32)
    expect(frameKey(fr)).toBe('32,0,32,32')
  })

  it('indicesRangeToFrames fills inclusive range left-to-right', () => {
    const frames = indicesRangeToFrames(2, 4, grid, 32, 32)
    expect(frames).toHaveLength(3)
    expect(frames[0]).toEqual({ x: 64, y: 0, w: 32, h: 32 })
    expect(frames[2]).toEqual({ x: 0, y: 32, w: 32, h: 32 })
  })

  it('framesToSortedIndices maps pixel rects back to indices', () => {
    const frames = indicesRangeToFrames(1, 3, grid, 32, 32)
    expect(framesToSortedIndices(frames, grid, 32, 32)).toEqual([1, 2, 3])
  })

  it('indicesSetToFrames preserves sort order', () => {
    const frames = indicesSetToFrames([3, 1, 2], grid, 32, 32)
    expect(framesToSortedIndices(frames, grid, 32, 32)).toEqual([1, 2, 3])
  })

  it('frameRangeFromIndices detects contiguous vs sparse', () => {
    expect(frameRangeFromIndices([1, 2, 3])).toEqual({
      start: 1,
      end: 3,
      contiguous: true,
    })
    expect(frameRangeFromIndices([1, 3])).toEqual({
      start: 1,
      end: 3,
      contiguous: false,
    })
  })

  it('clampFrameRange rejects inverted ranges', () => {
    expect(clampFrameRange(5, 2, 8)).toBeNull()
    expect(clampFrameRange(2, 5, 8)).toEqual({ start: 2, end: 5 })
  })
})
