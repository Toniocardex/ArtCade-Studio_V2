import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { TilemapLayer } from '../../types'
import type { Action } from '../../store/editor-store'
import { editorPaintTile, editorSurfaceToWorld } from '../../utils/wasm-bridge'
import { ensureSourceOnLayer } from '../../utils/tilemap-layer-sources'
import { getRuntimeCanvas, RUNTIME_SURFACE_OVERLAY_Z_INDEX } from '../../utils/runtime-canvas'
import { usePresentationSnapshot } from '../../utils/runtime-sync-service'

// ---------------------------------------------------------------------------
// TilePaintOverlay — sole tile-paint input while the Tileset Editor is open.
// ---------------------------------------------------------------------------

type Props = Readonly<{
  tilemap: TilemapLayer | undefined
  activeLayerId: string
  selectedTileCell: number
  sceneId: string
  paintTilesetAssetId: string
  dispatch: Dispatch<Action>
}>

export function TilePaintOverlay({
  tilemap, activeLayerId, selectedTileCell, sceneId, paintTilesetAssetId, dispatch,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const presentationSnapshot = usePresentationSnapshot()
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
    const rect = e.currentTarget.getBoundingClientRect()
    const csx = e.clientX - rect.left
    const csy = e.clientY - rect.top
    const dpr = window.devicePixelRatio || 1
    const world = editorSurfaceToWorld(csx * dpr, csy * dpr, presentationSnapshot?.revision)
    const col = Math.floor(world.x / tilemap.tileSize)
    const row = Math.floor(world.y / tilemap.tileSize)
    if (col < 0 || col >= tilemap.cols || row < 0 || row >= tilemap.rows) return null
    return { col, row }
  }

  const applyCell = useCallback((col: number, row: number, tileId: number) => {
    if (!tilemap) return
    let sourceIndex = 0
    if (tileId > 0) {
      sourceIndex = ensureSourceOnLayer(tilemap, paintTilesetAssetId).sourceIndex
    }
    editorPaintTile(col, row, tileId, activeLayerId, sourceIndex, paintTilesetAssetId)
    dispatch({
      type: 'TILEMAP_PAINT_CELL',
      sceneId,
      col,
      row,
      tileId,
      tilesetAssetId: paintTilesetAssetId,
    })
  }, [activeLayerId, dispatch, paintTilesetAssetId, sceneId, tilemap])

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
        zIndex: RUNTIME_SURFACE_OVERLAY_Z_INDEX,
        cursor: 'crosshair',
        pointerEvents: 'auto',
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
