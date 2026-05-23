import { useCallback, useEffect, useRef, useState } from 'react'
import type { ElementType } from 'react'
import { Image, Music, Code, FileText, ImagePlus, Trash2, Grid3x3 } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import { importImageIntoProject } from '../utils/api'
import { dirName } from '../utils/project'
import type { ImageAsset, ImagePointDef, TilesetAsset } from '../types'
import {
  isBackspaceKey,
  isInsidePanel,
  keyboardFocusElement,
  shouldIgnoreEditorShortcut,
} from '../utils/keyboard'

type Category = 'ALL' | 'IMAGES' | 'AUDIO' | 'SCRIPTS' | 'TILESETS'

const CATEGORIES: Category[] = ['ALL', 'IMAGES', 'AUDIO', 'SCRIPTS', 'TILESETS']

const ICON_MAP: Record<string, ElementType> = {
  IMAGES:   Image,
  AUDIO:    Music,
  SCRIPTS:  Code,
  TILESETS: Grid3x3,
}

function AssetIcon({ type }: { type: string }) {
  const Icon = ICON_MAP[type] ?? FileText
  const color =
    type === 'IMAGES'   ? 'var(--accent)'    :
    type === 'AUDIO'    ? 'var(--accent-2)'  :
    type === 'TILESETS' ? 'var(--purple)'    :
                          'var(--warn)'
  return <Icon size={22} color={color} />
}

export default function AssetBrowserPanel() {
  const { state, dispatch } = useEditor()
  const [cat, setCat]   = useState<Category>('ALL')
  const [msg, setMsg]   = useState<string | null>(null)
  const [selAssetId, setSelAssetId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const project   = state.project
  const images    = Object.values(project?.assets ?? {})
  const tilesets  = Object.values(project?.tilesets ?? {}) as TilesetAsset[]
  const selEntity = (project && state.selection.entityId != null)
    ? project.entities[state.selection.entityId]
    : null

  function openTilesetEditor(t: TilesetAsset) {
    dispatch({ type: 'TILESET_EDIT_OPEN', tilesetId: t.assetId })
  }

  function flash(t: string) {
    setMsg(t)
    window.setTimeout(() => setMsg(null), 3000)
  }

  function patchAssetPoints(assetId: string, points: ImagePointDef[]) {
    if (!project) return
    const assets = { ...(project.assets ?? {}) }
    const a = assets[assetId]
    if (!a) return
    assets[assetId] = { ...a, imagePoints: points }
    dispatch({ type: 'ASSET_ADD', asset: { ...a, imagePoints: points } })
  }

  const selAsset = selAssetId && project?.assets?.[selAssetId]
  const canRemove = Boolean(selAssetId && project?.assets?.[selAssetId])

  const removeSelectedAsset = useCallback(() => {
    if (!selAssetId || !project?.assets?.[selAssetId]) return
    const name = project.assets[selAssetId].name
    dispatch({ type: 'ASSET_REMOVE', assetId: selAssetId })
    setSelAssetId(null)
    flash(`Removed ${name}`)
  }, [selAssetId, project, dispatch])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && !isBackspaceKey(e)) return
      const focus = keyboardFocusElement(e)
      // Only remove assets via keyboard while the Assets panel has focus.
      if (!focus || !isInsidePanel(focus, 'assets')) return
      if (shouldIgnoreEditorShortcut(e)) return
      if (!selAssetId || !project?.assets?.[selAssetId]) return
      e.preventDefault()
      removeSelectedAsset()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selAssetId, project, removeSelectedAsset])

  // ── Import an image into the project's persistent asset library ───────────
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !project) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = String(reader.result)
      const buf  = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let relPath: string | null = null
      if (state.projectPath) {
        relPath = await importImageIntoProject(
          dirName(state.projectPath), file.name, bytes,
        )
      }
      // Browser / unsaved project: keep a stable path; persistence happens
      // once the project is saved with an assets/ folder. dataUrl drives the
      // immediate runtime render + thumbnail this session.
      const path = relPath ?? `assets/images/${file.name}`
      const asset: ImageAsset = {
        id:   `img_${Date.now().toString(36)}`,
        name: file.name,
        path,
        dataUrl,
      }
      dispatch({ type: 'ASSET_ADD', asset })
      flash(relPath ? `Imported ${file.name}` : `${file.name} (save project to persist)`)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function assignSprite(asset: ImageAsset) {
    if (!selEntity) { flash('Select an entity first, then double-click an image'); return }
    dispatch({
      type: 'ENTITY_SET_SPRITE',
      entityId: selEntity.id,
      sprite: { ...selEntity.sprite, spriteAssetId: asset.path },
    })
    flash(`Sprite "${asset.name}" → ${selEntity.name}`)
  }

  const showImages   = cat === 'ALL' || cat === 'IMAGES'
  const showTilesets = cat === 'ALL' || cat === 'TILESETS'
  const hasImages    = images.length > 0
  const hasTilesets  = tilesets.length > 0
  const showEmpty    = !project || (
    cat === 'ALL'      ? (!hasImages && !hasTilesets) :
    cat === 'IMAGES'   ? !hasImages :
    cat === 'TILESETS' ? !hasTilesets :
                         true   // AUDIO / SCRIPTS: not implemented yet
  )

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]" data-panel="assets">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={onPickFile}
      />

      {/* Category tabs + import */}
      <div className="flex items-center border-b border-[var(--border)] px-2 flex-shrink-0">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 text-[10px] font-bold transition-all ${
              cat === c
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {c}
          </button>
        ))}
        <div className="flex-1" />
        {msg && <span className="text-[9px] text-[var(--muted)] mr-3">{msg}</span>}
        <button
          type="button"
          onClick={removeSelectedAsset}
          disabled={!canRemove}
          title={canRemove ? 'Remove image (Delete)' : 'Select an imported image to remove'}
          className="flex items-center gap-1.5 px-3 py-1 my-1 mr-1 rounded text-[10px] font-semibold
                     border border-[var(--border-2)] text-[var(--muted)]
                     hover:text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-40"
        >
          <Trash2 size={12} /> Remove
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!project}
          className="flex items-center gap-1.5 px-3 py-1 my-1 rounded text-[10px] font-semibold
                     border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]
                     hover:bg-[var(--accent-bg-h)] disabled:opacity-40"
        >
          <ImagePlus size={12} /> Import image
        </button>
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {showEmpty && (
          <p className="text-[var(--muted)] text-[10px] mb-3 leading-relaxed">
            {!project
              ? 'No project loaded — use File → New Project or Open Project.'
              : cat === 'IMAGES'
                ? 'No images yet — use Import image. Double-click (with an entity selected) to assign a sprite.'
                : cat === 'TILESETS'
                  ? 'No tilesets yet — create one from the scene tilemap settings, then click here to edit.'
                  : 'No assets in this category yet.'}
          </p>
        )}
        <div className="grid grid-cols-6 gap-3">
          {showImages && images.map(asset => {
            const selected = selAssetId === asset.id
            return (
            <div
              key={asset.id}
              onClick={() => setSelAssetId(asset.id)}
              onDoubleClick={() => assignSprite(asset)}
              title={selEntity
                ? `Double-click → assign as sprite of "${selEntity.name}"`
                : 'Select an entity, then double-click to assign as its sprite'}
              className={`flex flex-col items-center gap-2 p-2 rounded border cursor-pointer transition-colors group
                         bg-[var(--bg)] ${
                selected
                  ? 'border-[var(--accent)] ring-1 ring-[rgb(var(--accent-rgb)/0.35)]'
                  : 'border-[var(--border)] hover:border-[rgb(var(--accent-rgb)/0.5)]'
              }`}
            >
              <div className="w-[22px] h-[22px] flex items-center justify-center group-hover:scale-110 transition-transform">
                {asset.dataUrl
                  ? <img src={asset.dataUrl} alt={asset.name}
                         className="max-w-full max-h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  : <AssetIcon type="IMAGES" />}
              </div>
              <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
                {asset.name}
              </span>
              <span className="text-[8px] text-[rgb(var(--muted-rgb)/0.5)]">image</span>
            </div>
            )
          })}

          {showTilesets && tilesets.map(t => (
            <div
              key={t.assetId}
              onClick={() => openTilesetEditor(t)}
              title={`Open "${t.name}" in the Tileset Editor`}
              className="flex flex-col items-center gap-2 p-2 rounded border cursor-pointer transition-colors group
                         bg-[var(--bg)] border-[var(--border)]
                         hover:border-[var(--purple)] hover:bg-[var(--panel-3)]"
            >
              <div className="w-[22px] h-[22px] flex items-center justify-center group-hover:scale-110 transition-transform">
                <AssetIcon type="TILESETS" />
              </div>
              <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
                {t.name}
              </span>
              <span className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] tabular-nums">
                {t.tileSize}px · {t.cols}×{t.rows}
              </span>
            </div>
          ))}
        </div>

        {selAsset && (
          <div className="mt-4 p-3 rounded border border-[var(--border)] bg-[var(--panel)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                Image points — {selAsset.name}
              </p>
              <button
                type="button"
                onClick={removeSelectedAsset}
                title="Remove image (Delete)"
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px]
                           text-[var(--muted)] hover:text-[var(--danger)]"
              >
                <Trash2 size={11} /> Remove
              </button>
            </div>
            <ul className="space-y-1 mb-2">
              {(selAsset.imagePoints ?? []).map((pt, i) => (
                <li key={pt.id || i} className="flex gap-2 items-center text-xs">
                  <input
                    className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-20"
                    value={pt.id}
                    placeholder="id"
                    onChange={(e) => {
                      const pts = [...(selAsset.imagePoints ?? [])]
                      pts[i] = { ...pt, id: e.target.value }
                      patchAssetPoints(selAsset.id, pts)
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-14"
                    value={pt.x}
                    onChange={(e) => {
                      const pts = [...(selAsset.imagePoints ?? [])]
                      pts[i] = { ...pt, x: parseFloat(e.target.value) || 0 }
                      patchAssetPoints(selAsset.id, pts)
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-14"
                    value={pt.y}
                    onChange={(e) => {
                      const pts = [...(selAsset.imagePoints ?? [])]
                      pts[i] = { ...pt, y: parseFloat(e.target.value) || 0 }
                      patchAssetPoints(selAsset.id, pts)
                    }}
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="text-[10px] text-[var(--accent)]"
              onClick={() => {
                const prev = selAsset.imagePoints ?? []
                patchAssetPoints(selAsset.id, [
                  ...prev,
                  { id: `point_${prev.length + 1}`, x: 0.5, y: 0.5 },
                ])
              }}
            >
              + Add point
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
