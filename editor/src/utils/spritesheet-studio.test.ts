import { describe, expect, it } from 'vitest'
import {
  clampFrameRange,
  deriveCellSizeFromLayout,
  deriveGrid,
  deriveStripLayout,
  frameAtCell,
  frameAtCellInSheet,
  frameForCell,
  frameKey,
  frameRangeFromIndices,
  framesToSortedIndices,
  guessStripSlicing,
  indicesInCellRect,
  indicesRangeToFrames,
  indicesSetToFrames,
  mergeFrameIndices,
  normalizeCellRect,
  resolveSlicing,
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

  it('frameAtCellInSheet clamps cells to sheet bounds', () => {
    const stripGrid = deriveGrid(64, 16, 32, 32)
    expect(stripGrid).toEqual({ cols: 2, rows: 1, totalFrames: 2 })
    const frames = indicesSetToFrames([0, 1], stripGrid, 32, 32, { w: 64, h: 16 })
    expect(frames[0]).toEqual({ x: 0, y: 0, w: 32, h: 16 })
    expect(frames[1]).toEqual({ x: 32, y: 0, w: 32, h: 16 })
    expect(framesToSortedIndices(frames, stripGrid, 32, 32)).toEqual([0, 1])
  })

  it('frameForCell matches frameAtCell when no sheet', () => {
    expect(frameForCell(1, 0, 32, 32, null)).toEqual(frameAtCell(1, 0, 32, 32))
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

  it('deriveCellSizeFromLayout divides sheet evenly', () => {
    expect(deriveCellSizeFromLayout(128, 32, 4, 1)).toEqual({ cellW: 32, cellH: 32 })
  })

  it('deriveStripLayout builds horizontal strip', () => {
    const strip = deriveStripLayout(128, 32, 4, 'horizontal')
    expect(strip.cols).toBe(4)
    expect(strip.rows).toBe(1)
    expect(strip.cellW).toBe(32)
  })

  it('guessStripSlicing detects simple horizontal and vertical strips', () => {
    expect(guessStripSlicing(64, 16)).toEqual({ axis: 'horizontal', frameCount: 4 })
    expect(guessStripSlicing(16, 64)).toEqual({ axis: 'vertical', frameCount: 4 })
    expect(guessStripSlicing(48, 32)).toBeNull()
  })

  it('resolveSlicing strip mode matches strip layout', () => {
    const r = resolveSlicing(128, 32, 'strip', {
      cellW: 32,
      cellH: 32,
      gridCols: 1,
      gridRows: 1,
      stripFrameCount: 4,
      stripAxis: 'horizontal',
    })
    expect(r.grid.cols).toBe(4)
    expect(r.grid.totalFrames).toBe(4)
  })

  it('indicesInCellRect lists cells in rectangle', () => {
    const grid = deriveGrid(64, 32, 32, 32)
    const rect = normalizeCellRect(0, 0, 1, 0)
    expect(indicesInCellRect(rect, grid)).toEqual([0, 1])
  })

  it('mergeFrameIndices unions without duplicates', () => {
    expect(mergeFrameIndices([0, 2], [1, 2])).toEqual([0, 1, 2])
  })
})
