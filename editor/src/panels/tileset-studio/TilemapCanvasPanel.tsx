import { useCallback, useEffect, useRef, useState } from 'react'
import { Grid2X2Plus, Eraser, MousePointer2 } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import type { TilesetAsset, TilemapLayer } from '../../types'

// ---------------------------------------------------------------------------
// TilemapCanvasPanel — pure React <canvas> tilemap painter.
// Left panel (TilePalettePanel) owns the brush cell selection;
// this panel owns the painting interaction on the scene tilemap.
// ---------------------------------------------------------------------------

const GRID_COLOR = 'rgba(255,255,255,0.08)'
const HOVER_COLOR = 'rgba(255,255,255,0.12)'

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  tilemap: TilemapLayer,
  tileset: TilesetAsset,
  img: HTMLImageElement | null,
  hoverCell: { col: number; row: number } | null,
  displayCellSize: number,
) {
  const { cols, rows, data } = tilemap
  const W = cols * displayCellSize
  const H = rows * displayCellSize
  ctx.clearRect(0, 0, W, H)

  // Checkerboard background
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#1e1e2e' : '#181825'
      ctx.fillRect(c * displayCellSize, r * displayCellSize, displayCellSize, displayCellSize)
    }
  }

  // Tiles — source is tileset.tileSize px, dest is displayCellSize px (auto-scaled)
  if (img) {
    const srcStep = tileset.tileSize + tileset.margin
    for (let i = 0; i < data.length; i++) {
      const tileId = data[i]
      if (!tileId) continue
      const sr = Math.floor((tileId - 1) / tileset.cols)
      const sc = (tileId - 1) % tileset.cols
      const sx = sc * srcStep
      const sy = sr * srcStep
      const dc = i % cols
      const dr = Math.floor(i / cols)
      try {
        ctx.drawImage(
          img,
          sx, sy, tileset.tileSize, tileset.tileSize,
          dc * displayCellSize, dr * displayCellSize, displayCellSize, displayCellSize,
        )
      } catch { /* corrupt frame */ }
    }
  } else {
    // Fallback: color blocks
    for (let i = 0; i < data.length; i++) {
      if (!data[i]) continue
      const dc = i % cols
      const dr = Math.floor(i / cols)
      ctx.fillStyle = 'rgba(100,150,255,0.35)'
      ctx.fillRect(dc * displayCellSize, dr * displayCellSize, displayCellSize, displayCellSize)
    }
  }

  // Grid lines
  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 1
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath(); ctx.moveTo(c * displayCellSize + 0.5, 0); ctx.lineTo(c * displayCellSize + 0.5, H); ctx.stroke()
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * displayCellSize + 0.5); ctx.lineTo(W, r * displayCellSize + 0.5); ctx.stroke()
  }

  // Hover
  if (hoverCell) {
    ctx.fillStyle = HOVER_COLOR
    ctx.fillRect(hoverCell.col * displayCellSize, hoverCell.row * displayCellSize, displayCellSize, displayCellSize)
  }
}

type Props = Readonly<{
  tileset: TilesetAsset
  sceneId: string
  tilemap: TilemapLayer | undefined
}>

export function TilemapCanvasPanel({ tileset, sceneId, tilemap }: Props) {
  const dispatch     = useEditorDispatch()
  const project      = useEditorSelector((s) => s.project)
  const selectedCell = useEditorSelector((s) => s.selectedTileCell)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef    = useRef<HTMLImageElement | null>(null)
  const [imgLoaded,  setImgLoaded]  = useState(false)
  const [hoverCell, setHoverCell]   = useState<{ col: number; row: number } | null>(null)
  const isPainting = useRef(false)

  // Load tileset image
  useEffect(() => {
    if (!project?.assets) return
    const imageAsset = Object.values(project.assets).find(
      (a) => a.path === tileset.spriteImagePath,
    )
    const url = imageAsset?.dataUrl
    if (!url) { imgRef.current = null; setImgLoaded(false); return }
    const img = new Image()
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.onerror = () => { imgRef.current = null; setImgLoaded(false) }
    img.src = url
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileset.assetId, tileset.spriteImagePath, project?.assets])

  // Redraw canvas whenever tilemap data, hover or tileset image changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !tilemap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawCanvas(ctx, tilemap, tileset, imgRef.current, hoverCell, tileset.tileSize)
  }, [tilemap, tileset, hoverCell, imgLoaded])

  function cellFromEvent(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || !tilemap) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top)  * scaleY
    const col = Math.floor(px / tileset.tileSize)
    const row = Math.floor(py / tileset.tileSize)
    if (col < 0 || col >= tilemap.cols || row < 0 || row >= tilemap.rows) return null
    return { col, row }
  }

  const paint = useCallback((col: number, row: number) => {
    if (!tilemap) return
    const tileId = selectedCell // 0 = eraser
    dispatch({ type: 'TILEMAP_PAINT_CELL', sceneId, col, row, tileId })
  }, [dispatch, sceneId, tilemap, selectedCell])

  function onPointerDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return
    const cell = cellFromEvent(e)
    if (!cell) return
    isPainting.current = true
    ;(e.currentTarget as HTMLCanvasElement).setPointerCapture((e.nativeEvent as PointerEvent).pointerId)
    paint(cell.col, cell.row)
  }

  function onPointerMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const cell = cellFromEvent(e)
    setHoverCell(cell)
    if (isPainting.current && cell) paint(cell.col, cell.row)
  }

  function onPointerUp() {
    isPainting.current = false
  }

  function onPointerLeave() {
    setHoverCell(null)
    isPainting.current = false
  }

  // Bind tileset to scene tilemap + auto-sync tileSize
  function bindTileset() {
    if (!tilemap) {
      dispatch({ type: 'TILEMAP_INIT', sceneId })
    }
    dispatch({ type: 'TILEMAP_SET_TILESETID', sceneId, assetId: tileset.assetId })
    // Sync the tilemap cell size to the tileset's tile size
    if (tilemap && tilemap.tileSize !== tileset.tileSize) {
      dispatch({ type: 'TILEMAP_SET_TILESIZE', sceneId, tileSize: tileset.tileSize })
    }
  }

  if (!tilemap) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[var(--bg)]">
        <div className="text-[var(--muted)] text-xs text-center px-6">
          No tilemap layer on this scene.<br />Create one to start painting.
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'TILEMAP_INIT', sceneId })}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold
                     border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]
                     hover:bg-[var(--accent-bg-h)]"
        >
          <Grid2X2Plus size={14} /> Create tilemap layer
        </button>
      </div>
    )
  }

  const { cols, rows } = tilemap
  // Always display using the tileset's native tile size for correct rendering.
  const displayCellSize = tileset.tileSize
  const sizeMismatch = tilemap.tileSize !== tileset.tileSize
  const needsBind = !tilemap.tilesetAssetId || tilemap.tilesetAssetId !== tileset.assetId

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg)] overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-3 h-9 border-b border-[var(--border)] bg-[var(--panel)] text-[10px] text-[var(--muted)]">
        <span>
          Tilemap: <span className="text-[var(--text)]">{cols}×{rows}</span>
          {' '}— cell <span className="text-[var(--text)]">{displayCellSize}px</span>
        </span>
        {sizeMismatch && !needsBind && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'TILEMAP_SET_TILESIZE', sceneId, tileSize: tileset.tileSize })}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border
                       border-amber-600/50 bg-amber-950/40 text-amber-400
                       hover:bg-amber-900/50"
            title={`Tilemap cell is ${tilemap.tileSize}px but tileset tile is ${tileset.tileSize}px — click to sync`}
          >
            ⚠ Sync grid to {tileset.tileSize}px
          </button>
        )}
        {needsBind && (
          <button
            type="button"
            onClick={bindTileset}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs border
                       border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]
                       hover:bg-[var(--accent-bg-h)]"
          >
            Bind tileset to scene
          </button>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {selectedCell === 0
            ? <><Eraser size={11} /> Eraser</>
            : <><MousePointer2 size={11} /> Tile #{selectedCell}</>}
        </span>
      </div>

      {/* Canvas scroll area */}
      <div className="flex-1 overflow-auto p-4">
        <canvas
          ref={canvasRef}
          width={cols * displayCellSize}
          height={rows * displayCellSize}
          className="border border-[var(--border)] cursor-crosshair block"
          style={{ imageRendering: 'pixelated', userSelect: 'none' }}
          onMouseDown={onPointerDown as unknown as React.MouseEventHandler<HTMLCanvasElement>}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerLeave}
        />
      </div>
    </div>
  )
}
