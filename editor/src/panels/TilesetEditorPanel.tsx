// ---------------------------------------------------------------------------
// TilesetEditorPanel (Phase F1) — load a spritesheet image, slice it with a
// regular grid (tileSize + margin), and pick the brush cell.
//
// The actual painting happens in the scene canvas (handled by C++, Phase F2);
// this panel only manages the tileset asset + the selected brush cell.
// Image loading uses a standard <input type=file> so it works both in the
// Tauri app and the plain-browser dev server (api.ts openImageDialog /
// readImageAsDataUrl remain available for a future "import into project").
// ---------------------------------------------------------------------------

import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Eraser, Trash2 } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import type { TilesetAsset } from '../types'

function deriveGrid(imgW: number, imgH: number, tileSize: number, margin: number) {
  const step = tileSize + margin
  const cols = step > 0 ? Math.max(1, Math.floor((imgW + margin) / step)) : 1
  const rows = step > 0 ? Math.max(1, Math.floor((imgH + margin) / step)) : 1
  return { cols, rows }
}

export default function TilesetEditorPanel() {
  const { state, dispatch } = useEditor()
  const { project, selection, selectedTileCell } = state

  const sceneId = selection.sceneId ?? project?.activeSceneId ?? ''
  const scene   = project?.scenes[sceneId]
  const tilesetId = scene?.tilemap?.tilesetAssetId
  const tileset: TilesetAsset | undefined =
    tilesetId ? project?.tilesets?.[tilesetId] : undefined

  const fileRef = useRef<HTMLInputElement>(null)
  // Local image preview + natural size (data URL not persisted in F1)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgWH, setImgWH]   = useState<{ w: number; h: number } | null>(null)
  const [tileSize, setTileSize] = useState(tileset?.tileSize ?? 32)
  const [margin, setMargin]     = useState(tileset?.margin ?? 0)

  const grid = useMemo(
    () => (imgWH ? deriveGrid(imgWH.w, imgWH.h, tileSize, margin)
                 : { cols: tileset?.cols ?? 0, rows: tileset?.rows ?? 0 }),
    [imgWH, tileSize, margin, tileset],
  )

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !project) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      const img = new Image()
      img.onload = () => {
        setImgUrl(url)
        setImgWH({ w: img.naturalWidth, h: img.naturalHeight })
        const { cols, rows } = deriveGrid(
          img.naturalWidth, img.naturalHeight, tileSize, margin,
        )
        const asset: TilesetAsset = {
          assetId: `tileset_${Date.now().toString(36)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          spriteImagePath: file.name, // F3/asset-pipeline resolves the real path
          tileSize, margin, cols, rows,
        }
        dispatch({ type: 'TILESET_ASSET_ADD', asset })
        if (scene)
          dispatch({ type: 'TILEMAP_SET_TILESETID', sceneId, assetId: asset.assetId })
        dispatch({ type: 'TILESET_SELECT_CELL', cellIndex: 1 })
      }
      img.src = url
    }
    reader.readAsDataURL(file)
    e.target.value = '' // allow re-picking the same file
  }

  // Re-derive cols/rows when tileSize/margin change (updates the asset).
  function applyGrid(nextTile: number, nextMargin: number) {
    setTileSize(nextTile); setMargin(nextMargin)
    if (!imgWH || !tileset) return
    const { cols, rows } = deriveGrid(imgWH.w, imgWH.h, nextTile, nextMargin)
    dispatch({
      type: 'TILESET_ASSET_ADD',
      asset: { ...tileset, tileSize: nextTile, margin: nextMargin, cols, rows },
    })
  }

  if (!project || !scene) {
    return (
      <div className="h-full bg-[#0B1121] flex items-center justify-center">
        <span className="text-[#9CA3AF] text-xs">No scene selected</span>
      </div>
    )
  }

  const hasImage = Boolean(imgUrl)
  const { cols, rows } = grid

  return (
    <div className="h-full flex bg-[#0B1121] select-none">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={onPickFile}
      />

      {/* Left: controls */}
      <div className="w-56 border-r border-[#1A253A] p-3 flex flex-col gap-3 flex-shrink-0">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded
                     text-xs font-semibold border border-[#0a5a5a] bg-[#062a2a]
                     text-[#00FFFF] hover:bg-[#0a3a3a]"
        >
          <ImagePlus size={13} /> Load tileset image
        </button>

        {(tileset || hasImage) && (
          <>
            <div className="text-[10px] text-[#9CA3AF] uppercase tracking-widest">
              {tileset?.name ?? 'New tileset'}
            </div>
            <label className="text-[9px] text-[#9CA3AF] uppercase flex items-center justify-between">
              Tile size
              <input
                type="number" min={1} value={tileSize}
                onChange={e => applyGrid(Math.max(1, Number(e.target.value)), margin)}
                className="w-16 bg-[#1A253A] border border-[#2D3748] text-[#00FFFF]
                           text-[11px] rounded px-2 py-0.5 text-right"
              />
            </label>
            <label className="text-[9px] text-[#9CA3AF] uppercase flex items-center justify-between">
              Margin
              <input
                type="number" min={0} value={margin}
                onChange={e => applyGrid(tileSize, Math.max(0, Number(e.target.value)))}
                className="w-16 bg-[#1A253A] border border-[#2D3748] text-[#00FFFF]
                           text-[11px] rounded px-2 py-0.5 text-right"
              />
            </label>
            <div className="text-[10px] text-[#9CA3AF] border-t border-[#1A253A] pt-2 space-y-1">
              <div>Grid: <span className="text-[#00FFFF]">{cols}×{rows}</span></div>
              <div>Brush cell:{' '}
                <span className="text-[#FF00FF]">
                  {selectedTileCell === 0 ? 'eraser' : `#${selectedTileCell}`}
                </span>
              </div>
            </div>
            <button
              onClick={() => dispatch({ type: 'TILESET_SELECT_CELL', cellIndex: 0 })}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs border ${
                selectedTileCell === 0
                  ? 'border-[#FF00FF] text-[#FF00FF] bg-[#FF00FF]/10'
                  : 'border-[#2D3748] text-[#9CA3AF] hover:text-[#D1D5DB]'
              }`}
            >
              <Eraser size={12} /> Eraser
            </button>
            {tileset && (
              <button
                onClick={() =>
                  dispatch({ type: 'TILESET_ASSET_REMOVE', assetId: tileset.assetId })
                }
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs
                           text-[#9CA3AF] hover:text-[#F87171]"
              >
                <Trash2 size={12} /> Remove tileset
              </button>
            )}
          </>
        )}
      </div>

      {/* Right: image + grid overlay (cell picker) */}
      <div className="flex-1 overflow-auto p-3">
        {!hasImage ? (
          <div className="h-full flex items-center justify-center text-[#9CA3AF] text-xs text-center">
            {tileset
              ? `Tileset "${tileset.name}" (${tileset.cols}×${tileset.rows}) — reload the image to edit the grid.`
              : 'Load a spritesheet image to slice it into tiles.'}
          </div>
        ) : (
          <div
            className="relative inline-block border border-[#1A253A]"
            style={{ lineHeight: 0 }}
          >
            <img src={imgUrl!} alt="tileset" className="block max-w-none" />
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
                gridAutoRows: `${tileSize}px`,
                gap: `${margin}px`,
                padding: 0,
              }}
            >
              {Array.from({ length: cols * rows }, (_, i) => {
                const cellId = i + 1 // 1-based
                const sel = cellId === selectedTileCell
                return (
                  <button
                    key={i}
                    onClick={() =>
                      dispatch({ type: 'TILESET_SELECT_CELL', cellIndex: cellId })
                    }
                    title={`cell #${cellId}`}
                    className={`border ${
                      sel
                        ? 'border-[#FF00FF] bg-[#FF00FF]/20'
                        : 'border-white/10 hover:border-[#00FFFF]/50'
                    }`}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
