// ---------------------------------------------------------------------------
// spritesheet-studio — grid / frame index helpers for Spritesheet Studio UI
// ---------------------------------------------------------------------------

import type { AnimationFrameRect } from '../types'

export type SpritesheetGrid = Readonly<{
  cols: number
  rows: number
  totalFrames: number
}>

export function deriveGrid(
  imgW: number,
  imgH: number,
  cellW: number,
  cellH: number,
): SpritesheetGrid {
  const cols = cellW > 0 ? Math.max(1, Math.floor(imgW / cellW)) : 1
  const rows = cellH > 0 ? Math.max(1, Math.floor(imgH / cellH)) : 1
  return { cols, rows, totalFrames: cols * rows }
}

export function frameKey(fr: AnimationFrameRect): string {
  return `${fr.x},${fr.y},${fr.w},${fr.h}`
}

export function frameAtCell(
  col: number,
  row: number,
  cellW: number,
  cellH: number,
): AnimationFrameRect {
  return { x: col * cellW, y: row * cellH, w: cellW, h: cellH }
}

export function cellIndex(col: number, row: number, cols: number): number {
  return row * cols + col
}

export function indexToCell(index: number, cols: number): { col: number; row: number } {
  return { col: index % cols, row: Math.floor(index / cols) }
}

export function clampFrameRange(
  start: number,
  end: number,
  totalFrames: number,
): { start: number; end: number } | null {
  if (totalFrames <= 0) return null
  const max = totalFrames - 1
  const s = Math.max(0, Math.min(max, Math.floor(start)))
  const e = Math.max(0, Math.min(max, Math.floor(end)))
  if (e < s) return null
  return { start: s, end: e }
}

/** Map pixel frames to sorted linear indices (L→R, T→B). Unknown rects are omitted. */
export function framesToSortedIndices(
  frames: readonly AnimationFrameRect[],
  grid: SpritesheetGrid,
  cellW: number,
  cellH: number,
): number[] {
  const indices: number[] = []
  for (const fr of frames) {
    if (fr.w <= 0 || fr.h <= 0) continue
    const col = Math.round(fr.x / cellW)
    const row = Math.round(fr.y / cellH)
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue
    if (fr.w !== cellW || fr.h !== cellH) continue
    indices.push(cellIndex(col, row, grid.cols))
  }
  return [...new Set(indices)].sort((a, b) => a - b)
}

/** All frame indices from start through end inclusive. */
export function indicesRangeToFrames(
  start: number,
  end: number,
  grid: SpritesheetGrid,
  cellW: number,
  cellH: number,
): AnimationFrameRect[] {
  const clamped = clampFrameRange(start, end, grid.totalFrames)
  if (!clamped) return []
  const out: AnimationFrameRect[] = []
  for (let i = clamped.start; i <= clamped.end; i++) {
    const { col, row } = indexToCell(i, grid.cols)
    out.push(frameAtCell(col, row, cellW, cellH))
  }
  return out
}

export function indicesSetToFrames(
  indices: readonly number[],
  grid: SpritesheetGrid,
  cellW: number,
  cellH: number,
): AnimationFrameRect[] {
  const sorted = [...new Set(indices)].filter((i) => i >= 0 && i < grid.totalFrames).sort((a, b) => a - b)
  return sorted.map((i) => {
    const { col, row } = indexToCell(i, grid.cols)
    return frameAtCell(col, row, cellW, cellH)
  })
}

export type FrameRangeUi = Readonly<{
  start: number
  end: number
  contiguous: boolean
}>

/** Derive start/end for range fields; contiguous only if selection is one uninterrupted interval. */
export function frameRangeFromIndices(indices: readonly number[]): FrameRangeUi | null {
  if (indices.length === 0) return null
  const sorted = [...indices].sort((a, b) => a - b)
  const start = sorted[0]
  const end = sorted[sorted.length - 1]
  const contiguous = sorted.length === end - start + 1
  return { start, end, contiguous }
}

export function frameRangeFromFrames(
  frames: readonly AnimationFrameRect[],
  grid: SpritesheetGrid,
  cellW: number,
  cellH: number,
): FrameRangeUi | null {
  return frameRangeFromIndices(framesToSortedIndices(frames, grid, cellW, cellH))
}
