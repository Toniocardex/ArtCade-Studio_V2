// ---------------------------------------------------------------------------
// spritesheet-studio — grid / frame index helpers for Spritesheet Studio UI
// ---------------------------------------------------------------------------

import type { AnimationFrameRect } from '../types'

export type SpritesheetGrid = Readonly<{
  cols: number
  rows: number
  totalFrames: number
}>

export type SlicingMode = 'cell' | 'layout' | 'strip'
export type StripAxis = 'horizontal' | 'vertical'

export type StripSlicingGuess = Readonly<{
  axis: StripAxis
  frameCount: number
}> | null

export type GridRemainder = Readonly<{
  remainderW: number
  remainderH: number
}>

export type DerivedSlicing = Readonly<{
  cellW: number
  cellH: number
  grid: SpritesheetGrid
  remainder: GridRemainder
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

export function gridRemainder(
  imgW: number,
  imgH: number,
  cellW: number,
  cellH: number,
  grid: SpritesheetGrid,
): GridRemainder {
  return {
    remainderW: Math.max(0, imgW - grid.cols * cellW),
    remainderH: Math.max(0, imgH - grid.rows * cellH),
  }
}

export function deriveCellSizeFromLayout(
  imgW: number,
  imgH: number,
  cols: number,
  rows: number,
): { cellW: number; cellH: number } {
  const c = Math.max(1, Math.floor(cols))
  const r = Math.max(1, Math.floor(rows))
  return {
    cellW: Math.max(1, Math.floor(imgW / c)),
    cellH: Math.max(1, Math.floor(imgH / r)),
  }
}

export function deriveLayoutFromCellSize(
  imgW: number,
  imgH: number,
  cellW: number,
  cellH: number,
): SpritesheetGrid {
  return deriveGrid(imgW, imgH, cellW, cellH)
}

export function deriveStripLayout(
  imgW: number,
  imgH: number,
  frameCount: number,
  axis: StripAxis,
): { cols: number; rows: number; cellW: number; cellH: number } {
  const n = Math.max(1, Math.floor(frameCount))
  if (axis === 'vertical') {
    const rows = n
    const cols = 1
    return {
      cols,
      rows,
      ...deriveCellSizeFromLayout(imgW, imgH, cols, rows),
    }
  }
  const cols = n
  const rows = 1
  return {
    cols,
    rows,
    ...deriveCellSizeFromLayout(imgW, imgH, cols, rows),
  }
}

export function guessStripSlicing(imgW: number, imgH: number): StripSlicingGuess {
  const maxFrames = 64
  if (imgW <= 0 || imgH <= 0) return null

  const horizontalFrames = imgW % imgH === 0 ? imgW / imgH : 0
  if (horizontalFrames >= 2 && horizontalFrames <= maxFrames && imgW > imgH) {
    return { axis: 'horizontal', frameCount: horizontalFrames }
  }

  const verticalFrames = imgH % imgW === 0 ? imgH / imgW : 0
  if (verticalFrames >= 2 && verticalFrames <= maxFrames && imgH > imgW) {
    return { axis: 'vertical', frameCount: verticalFrames }
  }

  return null
}

export function resolveSlicing(
  imgW: number,
  imgH: number,
  mode: SlicingMode,
  params: Readonly<{
    cellW: number
    cellH: number
    gridCols: number
    gridRows: number
    stripFrameCount: number
    stripAxis: StripAxis
  }>,
): DerivedSlicing {
  let cellW = params.cellW
  let cellH = params.cellH
  let grid: SpritesheetGrid

  if (mode === 'layout') {
    const size = deriveCellSizeFromLayout(imgW, imgH, params.gridCols, params.gridRows)
    cellW = size.cellW
    cellH = size.cellH
    grid = {
      cols: Math.max(1, Math.floor(params.gridCols)),
      rows: Math.max(1, Math.floor(params.gridRows)),
      totalFrames: Math.max(1, Math.floor(params.gridCols)) * Math.max(1, Math.floor(params.gridRows)),
    }
  } else if (mode === 'strip') {
    const strip = deriveStripLayout(imgW, imgH, params.stripFrameCount, params.stripAxis)
    cellW = strip.cellW
    cellH = strip.cellH
    grid = { cols: strip.cols, rows: strip.rows, totalFrames: strip.cols * strip.rows }
  } else {
    grid = deriveGrid(imgW, imgH, cellW, cellH)
  }

  return {
    cellW,
    cellH,
    grid,
    remainder: gridRemainder(imgW, imgH, cellW, cellH, grid),
  }
}

export type CellRect = Readonly<{
  colMin: number
  colMax: number
  rowMin: number
  rowMax: number
}>

export function normalizeCellRect(col0: number, row0: number, col1: number, row1: number): CellRect {
  return {
    colMin: Math.min(col0, col1),
    colMax: Math.max(col0, col1),
    rowMin: Math.min(row0, row1),
    rowMax: Math.max(row0, row1),
  }
}

export function indicesInCellRect(rect: CellRect, grid: SpritesheetGrid): number[] {
  const out: number[] = []
  for (let row = rect.rowMin; row <= rect.rowMax; row++) {
    for (let col = rect.colMin; col <= rect.colMax; col++) {
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue
      out.push(cellIndex(col, row, grid.cols))
    }
  }
  return out
}

export function mergeFrameIndices(base: readonly number[], added: readonly number[]): number[] {
  return [...new Set([...base, ...added])].sort((a, b) => a - b)
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

/** Frame rect clipped to sheet bounds (avoids oversized cells on short strips). */
export function frameAtCellInSheet(
  col: number,
  row: number,
  cellW: number,
  cellH: number,
  imgW: number,
  imgH: number,
): AnimationFrameRect {
  const x = col * cellW
  const y = row * cellH
  const w = Math.max(0, Math.min(cellW, imgW - x))
  const h = Math.max(0, Math.min(cellH, imgH - y))
  return { x, y, w, h }
}

export function frameForCell(
  col: number,
  row: number,
  cellW: number,
  cellH: number,
  sheet: { w: number; h: number } | null,
): AnimationFrameRect {
  if (sheet && sheet.w > 0 && sheet.h > 0) {
    return frameAtCellInSheet(col, row, cellW, cellH, sheet.w, sheet.h)
  }
  return frameAtCell(col, row, cellW, cellH)
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
    const ox = col * cellW
    const oy = row * cellH
    if (Math.abs(fr.x - ox) > 0.5 || Math.abs(fr.y - oy) > 0.5) continue
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
  sheet: { w: number; h: number } | null = null,
): AnimationFrameRect[] {
  const clamped = clampFrameRange(start, end, grid.totalFrames)
  if (!clamped) return []
  const out: AnimationFrameRect[] = []
  for (let i = clamped.start; i <= clamped.end; i++) {
    const { col, row } = indexToCell(i, grid.cols)
    out.push(frameForCell(col, row, cellW, cellH, sheet))
  }
  return out
}

export function indicesSetToFrames(
  indices: readonly number[],
  grid: SpritesheetGrid,
  cellW: number,
  cellH: number,
  sheet: { w: number; h: number } | null = null,
): AnimationFrameRect[] {
  const sorted = [...new Set(indices)].filter((i) => i >= 0 && i < grid.totalFrames).sort((a, b) => a - b)
  return sorted.map((i) => {
    const { col, row } = indexToCell(i, grid.cols)
    return frameForCell(col, row, cellW, cellH, sheet)
  })
}

export function maxFrameExtents(frames: readonly AnimationFrameRect[]): { w: number; h: number } {
  let w = 0
  let h = 0
  for (const fr of frames) {
    if (fr.w > w) w = fr.w
    if (fr.h > h) h = fr.h
  }
  return { w, h }
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
