import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { RefObject } from 'react'
import type { TilemapLayer } from '../../types'
import type { Action } from '../../store/editor-store'
import { editorPaintTile } from '../../utils/wasm-bridge'
import { getRuntimeCanvas } from '../../utils/runtime-canvas'

// ---------------------------------------------------------------------------
// TilePaintOverlay — transparent div covering the WASM canvas.
// Active when the TilesetEditorModal is open (!isPlaying, editingTilesetId set).
//
// Fan-out model: each stroke cell is dispatched to BOTH the React store
// (TILEMAP_PAINT_CELL → tilemap.data → fingerprint dh → tilemap_data_only sync)
// and the WASM runtime (editorPaintTile → immediate visual feedback).
// Right-click = erase (tileId 0). Bresenham interpolation for fast drags.
// ---------------------------------------------------------------------------

type Props = Readonly<{
  scrollRef: RefObject<HTMLDivElement | null>
  zoom: number
  tilemap: TilemapLayer | undefined
  activeLayerName: string
  selectedTileCell: number
  sceneId: string
  dispatch: Dispatch<Action>
}>

export function TilePaintOverlay({
  scrollRef, zoom, tilemap, activeLayerName, selectedTileCell, sceneId, dispatch,
}: Props) {
  // Track overlay size to match the canvas element exactly.
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const canvas = getRuntimeCanvas()
    const update = () => {
      const s = window.getComputedStyle(canvas)
      setSize({ w: parseFloat(s.width) || 0, h: parseFloat(s.height) || 0 })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  const isPainting = useRef<'draw' | 'erase' | null>(null)
  const lastCell   = useRef<{ col: number; row: number } | null>(null)

  function cellFromEvent(e: React.PointerEvent<HTMLDivElement>) {
    if (!tilemap) return null
    const el = scrollRef.current
    if (!el) return null
    // Overlay is co-located with the WASM canvas (same sticky origin).
    // World = (scrollLeft + cssPxFromOverlayLeft) / zoom
    const rect = e.currentTarget.getBoundingClientRect()
    const csx = e.clientX - rect.left
    const csy = e.clientY - rect.top
    const worldX = (el.scrollLeft + csx) / zoom
    const worldY = (el.scrollTop  + csy) / zoom
    const col = Math.floor(worldX / tilemap.tileSize)
    const row = Math.floor(worldY / tilemap.tileSize)
    if (col < 0 || col >= tilemap.cols || row < 0 || row >= tilemap.rows) return null
    return { col, row }
  }

  const applyCell = useCallback((col: number, row: number, tileId: number) => {
    if (!tilemap) return
    editorPaintTile(col, row, tileId, activeLayerName)
    dispatch({ type: 'TILEMAP_PAINT_CELL', sceneId, col, row, tileId })
  }, [activeLayerName, dispatch, sceneId, tilemap])

  // Bresenham line: fill all cells between two positions (fast drag continuity).
  const applyLine = useCallback((
    from: { col: number; row: number },
    to:   { col: number; row: number },
    tileId: number,
  ) => {
    let { col: x0, row: y0 } = from
    const { col: x1, row: y1 } = to
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      applyCell(x0, y0, tileId)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }, [applyCell])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.button !== 2) return
    const cell = cellFromEvent(e)
    if (!cell) return
    const mode: 'draw' | 'erase' = e.button === 2 ? 'erase' : 'draw'
    isPainting.current = mode
    lastCell.current   = cell
    e.currentTarget.setPointerCapture(e.pointerId)
    applyCell(cell.col, cell.row, mode === 'erase' ? 0 : selectedTileCell)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPainting.current) return
    const cell = cellFromEvent(e)
    if (!cell) return
    const from = lastCell.current
    if (!from) { lastCell.current = cell; return }
    if (from.col === cell.col && from.row === cell.row) return
    const tileId = isPainting.current === 'erase' ? 0 : selectedTileCell
    applyLine(from, cell, tileId)
    lastCell.current = cell
  }

  function onPointerUp() {
    isPainting.current = null
    lastCell.current   = null
  }

  if (!tilemap || size.w === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size.w,
        height: size.h,
        zIndex: 2,
        cursor: 'crosshair',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}
