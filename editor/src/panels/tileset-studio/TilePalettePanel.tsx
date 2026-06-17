import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ImagePlus, Eraser, Trash2 } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { assetOrchestrator } from '../../utils/asset-orchestrator'
import { dirName } from '../../utils/project'
import { buildTilesetFromImageFile } from '../../utils/tileset-import'
import {
  isBlobPreviewSrc,
  resolveImagePreviewSrc,
  revokeImagePreviewSrc,
} from '../../utils/image-preview-src'
import type { TilesetAsset } from '../../types'

type GridInputProps = Readonly<{
  label: string
  value: number
  min: number
  onCommit: (v: number) => void
}>

function GridInput({ label, value, min, onCommit }: GridInputProps) {
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value))
  }, [value])

  const commit = useCallback(() => {
    const n = Math.max(min, Math.round(Number(draft)))
    if (Number.isFinite(n)) { onCommit(n); setDraft(String(n)) }
    else setDraft(String(value))
  }, [draft, min, onCommit, value])

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider shrink-0">{label}</span>
      <input
        ref={inputRef}
        type="number"
        min={min}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); inputRef.current?.blur() }
          if (e.key === 'Escape') { setDraft(String(value)); inputRef.current?.blur() }
          e.stopPropagation()
        }}
        className="w-20 bg-[var(--surface,var(--border))] border border-[var(--border-2)]
                   text-[var(--text)] text-[12px] font-mono rounded
                   px-2 py-1 text-right
                   [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                   focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  )
}

function deriveGrid(imgW: number, imgH: number, tileSize: number, margin: number) {
  const step = tileSize + margin
  const cols = step > 0 ? Math.max(1, Math.floor((imgW + margin) / step)) : 1
  const rows = step > 0 ? Math.max(1, Math.floor((imgH + margin) / step)) : 1
  return { cols, rows }
}

type Props = Readonly<{
  tileset: TilesetAsset
  onRemove: () => void
}>

export function TilePalettePanel({ tileset, onRemove }: Props) {
  const dispatch     = useEditorDispatch()
  const project      = useEditorSelector((s) => s.project)
  const projectPath  = useEditorSelector((s) => s.projectPath)
  const selectedCell = useEditorSelector((s) => s.selectedTileCell)
  const selection    = useEditorSelector((s) => s.selection)
  const sceneId      = selection.sceneId ?? project?.activeSceneId ?? ''

  const fileRef = useRef<HTMLInputElement>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgWH,  setImgWH]  = useState<{ w: number; h: number } | null>(null)
  const [tileSize, setTileSize] = useState(tileset.tileSize)
  const [margin,   setMargin]   = useState(tileset.margin)

  useEffect(() => {
    let cancelled = false
    setTileSize(tileset.tileSize)
    setMargin(tileset.margin)

    void (async () => {
      const src = await resolveImagePreviewSrc(
        { path: tileset.spriteImagePath, dataUrl: tileset.previewDataUrl },
        projectPath,
      )
      if (cancelled) {
        if (isBlobPreviewSrc(src)) revokeImagePreviewSrc(src)
        return
      }
      if (!src) {
        setImgUrl(null)
        setImgWH(null)
        return
      }
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        setImgUrl(src)
        setImgWH({ w: img.naturalWidth, h: img.naturalHeight })
      }
      img.onerror = () => {
        if (cancelled) return
        setImgUrl(null)
        setImgWH(null)
      }
      img.src = src
    })()

    return () => {
      cancelled = true
    }
  }, [tileset.assetId, tileset.spriteImagePath, tileset.previewDataUrl, projectPath])

  const grid = useMemo(
    () => imgWH
      ? deriveGrid(imgWH.w, imgWH.h, tileSize, margin)
      : { cols: tileset.cols, rows: tileset.rows },
    [imgWH, tileSize, margin, tileset.cols, tileset.rows],
  )

  function applyGrid(nextTile: number, nextMargin: number) {
    setTileSize(nextTile)
    setMargin(nextMargin)
    if (!imgWH) return
    const { cols, rows } = deriveGrid(imgWH.w, imgWH.h, nextTile, nextMargin)
    dispatch({ type: 'TILESET_ASSET_ADD', asset: { ...tileset, tileSize: nextTile, margin: nextMargin, cols, rows } })
    const sceneTilemap = sceneId ? project?.scenes[sceneId]?.tilemap : undefined
    if (sceneTilemap?.tilesetAssetId === tileset.assetId && sceneTilemap.tileSize !== nextTile && sceneId) {
      dispatch({ type: 'TILEMAP_SET_TILESIZE', sceneId, tileSize: nextTile })
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !project) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (!url) return
      const img = new Image()
      img.onload = async () => {
        try {
          setImgUrl(url)
          setImgWH({ w: img.naturalWidth, h: img.naturalHeight })
          const bytes = new Uint8Array(await file.arrayBuffer())
          const root = projectPath ? dirName(projectPath) : null
          const { tileset: nextTileset } = await buildTilesetFromImageFile({
            file,
            bytes,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            previewDataUrl: url,
            projectRoot: root,
            tileSize,
            margin,
            existingAssetId: tileset.assetId,
            existingName: tileset.name,
          })
          dispatch({ type: 'TILESET_ASSET_ADD', asset: nextTileset })
          dispatch({ type: 'TILESET_SELECT_CELL', cellIndex: 1 })
          await assetOrchestrator.ensureTilesetImageRegistered(project, nextTileset, root ?? '')
        } catch (err) {
          console.error('[Tileset] Image replace failed:', err)
        }
      }
      img.src = url
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={onPickFile} />

      {/* Controls */}
      <div className="shrink-0 flex flex-col gap-3 p-3 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-semibold
                     border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]
                     hover:bg-[var(--accent-bg-h)]"
        >
          <ImagePlus size={13} /> Load / replace image
        </button>

        <div className="space-y-2.5">
          <GridInput
            label="Tile size"
            value={tileSize}
            min={1}
            onCommit={(v) => applyGrid(v, margin)}
          />
          <GridInput
            label="Margin"
            value={margin}
            min={0}
            onCommit={(v) => applyGrid(tileSize, v)}
          />
        </div>

        <div className="text-[10px] text-[var(--muted)] space-y-0.5">
          <div>Grid: <span className="text-[var(--text)]">{grid.cols}×{grid.rows}</span></div>
          <div>Brush: <span className="text-[var(--text)]">{selectedCell === 0 ? 'Eraser' : `Cell #${selectedCell}`}</span></div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'TILESET_SELECT_CELL', cellIndex: 0 })}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs border ${
              selectedCell === 0
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.1)]'
                : 'border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Eraser size={12} /> Eraser
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-[var(--muted)] hover:text-[var(--danger)] border border-transparent hover:border-[var(--border-2)]"
            title="Remove tileset from project"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Tile grid — scrollable, fills remaining height */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {imgUrl ? (
          <div className="relative inline-block border border-[var(--border)]" style={{ lineHeight: 0 }}>
            <img src={imgUrl} alt={tileset.name} className="block max-w-none" />
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${grid.cols}, ${tileSize}px)`,
                gridAutoRows: `${tileSize}px`,
                gap: `${margin}px`,
              }}
            >
              {Array.from({ length: grid.cols * grid.rows }, (_, i) => {
                const cellId = i + 1
                const sel = cellId === selectedCell
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => dispatch({ type: 'TILESET_SELECT_CELL', cellIndex: cellId })}
                    title={`Tile #${cellId}`}
                    className={`border ${
                      sel
                        ? 'border-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.25)]'
                        : 'border-[var(--border)] hover:border-[rgb(var(--accent-rgb)/0.5)]'
                    }`}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-[var(--muted)] text-[10px] text-center px-4">
            {`"${tileset.name}" (${tileset.cols}×${tileset.rows}) — load image to edit`}
          </div>
        )}
      </div>
    </div>
  )
}
