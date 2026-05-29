import { useCallback, useRef, useState, type PointerEvent } from 'react'
import {
  frameKey,
  indicesInCellRect,
  normalizeCellRect,
  frameAtCell,
} from '../../utils/spritesheet-studio'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'
import { AtlasViewportToolbar } from './AtlasViewportToolbar'
import { useAtlasViewport } from './useAtlasViewport'

const DRAG_THRESHOLD_PX = 4

type AtlasGridProps = Readonly<{
  session: SpritesheetStudioSession
}>

type DragState = Readonly<{
  col0: number
  row0: number
  col1: number
  row1: number
  additive: boolean
}>

export function AtlasGrid({ session }: AtlasGridProps) {
  const {
    previewSrc,
    imgWH,
    grid,
    effectiveCellW: cellW,
    effectiveCellH: cellH,
    selectedKeys,
    toggleCell,
    setSelectionIndices,
    selectAllFrames,
    clearSelection,
    activeClip,
  } = session

  const viewport = useAtlasViewport(imgWH)
  const { scrollRef, zoom, displayW, displayH } = viewport
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const [dragRect, setDragRect] = useState<DragState | null>(null)

  const scaledCellW = cellW * zoom
  const scaledCellH = cellH * zoom

  const pointerToCell = useCallback(
    (clientX: number, clientY: number): { col: number; row: number } | null => {
      const sheet = sheetRef.current
      if (!sheet || cellW <= 0 || cellH <= 0) return null
      const rect = sheet.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null
      const col = Math.floor(x / scaledCellW)
      const row = Math.floor(y / scaledCellH)
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null
      return { col, row }
    },
    [scaledCellW, scaledCellH, grid.cols, grid.rows, cellW, cellH],
  )

  const finishDrag = useCallback(
    (state: DragState) => {
      const rect = normalizeCellRect(state.col0, state.row0, state.col1, state.row1)
      const indices = indicesInCellRect(rect, grid)
      if (indices.length > 0) setSelectionIndices(indices, state.additive)
    },
    [grid, setSelectionIndices],
  )

  const onPointerDown = (e: PointerEvent, col: number, row: number) => {
    if (!activeClip) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    dragRef.current = { col0: col, row0: row, col1: col, row1: row, additive: e.shiftKey }
    setDragRect(dragRef.current)
  }

  const onPointerMove = (e: PointerEvent) => {
    const start = pointerStartRef.current
    const drag = dragRef.current
    if (!start || !drag) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    const cell = pointerToCell(e.clientX, e.clientY)
    if (!cell) return
    const next = { ...drag, col1: cell.col, row1: cell.row }
    dragRef.current = next
    setDragRect(next)
  }

  const onPointerUp = (e: PointerEvent, col: number, row: number) => {
    const start = pointerStartRef.current
    const drag = dragRef.current
    pointerStartRef.current = null
    dragRef.current = null
    setDragRect(null)
    if (!drag || !start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
      toggleCell(col, row)
      return
    }
    finishDrag(drag)
  }

  if (!previewSrc || !imgWH) {
    return (
      <p className="text-sm text-[var(--muted)] p-4">
        Save the project or re-import the image to edit animation frames on this sheet.
      </p>
    )
  }

  const dragOverlay =
    dragRect != null
      ? normalizeCellRect(dragRect.col0, dragRect.row0, dragRect.col1, dragRect.row1)
      : null

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <AtlasViewportToolbar
        viewport={viewport}
        imgWH={imgWH}
        gridLabel={`grid ${grid.cols}×${grid.rows}`}
        cellLabel={`cell ${cellW}×${cellH}`}
        onSelectAll={selectAllFrames}
        onClearSelection={clearSelection}
        canEditSelection={activeClip != null && grid.totalFrames > 0}
      />
      <div
        ref={scrollRef}
        className="relative flex-1 min-h-0 overflow-auto border-t border-[var(--border)] bg-[var(--panel-3)]"
        style={{
          backgroundImage:
            'linear-gradient(45deg, rgb(var(--border-rgb) / 0.35) 25%, transparent 25%), linear-gradient(-45deg, rgb(var(--border-rgb) / 0.35) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(var(--border-rgb) / 0.35) 75%), linear-gradient(-45deg, transparent 75%, rgb(var(--border-rgb) / 0.35) 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
        }}
        data-testid="spritesheet-atlas-viewport"
      >
        <div className="min-w-full min-h-full flex items-center justify-center p-6 box-border">
          <div
            ref={sheetRef}
            className="relative shrink-0 border border-[var(--border-2)]"
            style={{ width: displayW, height: displayH }}
          >
            <img
              src={previewSrc}
              alt=""
              draggable={false}
              className="block max-w-none pointer-events-none select-none"
              style={{
                imageRendering: 'pixelated',
                width: displayW,
                height: displayH,
              }}
            />
            <div
              className="absolute inset-0 grid pointer-events-auto"
              style={{
                gridTemplateColumns: `repeat(${grid.cols}, ${scaledCellW}px)`,
                gridTemplateRows: `repeat(${grid.rows}, ${scaledCellH}px)`,
                width: displayW,
                height: displayH,
              }}
            >
              {Array.from({ length: grid.totalFrames }, (_, i) => {
                const col = i % grid.cols
                const row = Math.floor(i / grid.cols)
                const fr = frameAtCell(col, row, cellW, cellH)
                const key = frameKey(fr)
                const on = selectedKeys.has(key)
                const inDrag =
                  dragOverlay != null &&
                  col >= dragOverlay.colMin &&
                  col <= dragOverlay.colMax &&
                  row >= dragOverlay.rowMin &&
                  row <= dragOverlay.rowMax
                return (
                  <button
                    key={key}
                    type="button"
                    className={`border border-[rgb(255_255_255/0.2)] touch-none ${
                      on
                        ? 'bg-[rgb(var(--accent-rgb)/0.4)]'
                        : inDrag
                          ? 'bg-[rgb(var(--accent-rgb)/0.2)]'
                          : 'bg-transparent hover:bg-[rgb(255_255_255/0.08)]'
                    }`}
                    onPointerDown={(e) => onPointerDown(e, col, row)}
                    onPointerMove={onPointerMove}
                    onPointerUp={(e) => onPointerUp(e, col, row)}
                    onPointerCancel={(e) => onPointerUp(e, col, row)}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[9px] text-[var(--muted)] px-3 py-1 shrink-0">
        Drag to select a rectangle. Shift+drag adds to the selection. Click toggles one cell.
      </p>
    </div>
  )
}
