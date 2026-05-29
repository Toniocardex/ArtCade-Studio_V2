import { useCallback, useEffect, useRef, useState } from 'react'
import type { ElementType } from 'react'
import { Image, Music, Code, FileText, ImagePlus, Trash2, Grid3x3 } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import { importImageIntoProject } from '../utils/api'
import { importAudioIntoProject, readProjectFileBytes } from '../utils/asset-file-api'
import { dirName } from '../utils/project'
import type { AnimationClipDef, AudioAsset, ImageAsset, ImagePointDef, ProjectDoc, TilesetAsset } from '../types'
import { AnimationClipsEditor } from '../components/AnimationClipsEditor'
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

const ASSET_ICON_COLOR: Record<string, string> = {
  IMAGES: 'var(--accent)',
  AUDIO: 'var(--accent-2)',
  TILESETS: 'var(--purple)',
}

function assetIconColor(type: string): string {
  return ASSET_ICON_COLOR[type] ?? 'var(--warn)'
}

function categoryShowsEmpty(
  cat: Category,
  project: ProjectDoc | null,
  hasImages: boolean,
  hasTilesets: boolean,
  hasAudio: boolean,
): boolean {
  if (!project) return true
  if (cat === 'ALL') return !hasImages && !hasTilesets && !hasAudio
  if (cat === 'IMAGES') return !hasImages
  if (cat === 'TILESETS') return !hasTilesets
  if (cat === 'AUDIO') return !hasAudio
  return true
}

function emptyCategoryMessage(cat: Category, project: ProjectDoc | null): string {
  if (!project) {
    return 'No project loaded — use File → New Project or Open Project.'
  }
  if (cat === 'IMAGES') {
    return 'No images yet — use Import image. Double-click (with an entity selected) to assign a sprite.'
  }
  if (cat === 'TILESETS') {
    return 'No tilesets yet — create one from the scene tilemap settings, then click here to edit.'
  }
  if (cat === 'AUDIO') {
    return 'No audio yet — use Import audio.'
  }
  return 'No assets in this category yet.'
}

function fileReaderDataUrl(result: string | ArrayBuffer | null): string {
  return typeof result === 'string' ? result : ''
}

type AssetIconProps = Readonly<{ type: string }>

function AssetIcon({ type }: AssetIconProps) {
  const Icon = ICON_MAP[type] ?? FileText
  return <Icon size={22} color={assetIconColor(type)} />
}

const CARD_BTN =
  'flex flex-col items-center gap-2 p-2 rounded border cursor-pointer transition-colors group bg-[var(--bg)] text-left w-full'

type ImageAssetCardProps = Readonly<{
  asset: ImageAsset
  selected: boolean
  entityName: string | null
  onSelect: () => void
  onAssign: () => void
}>

function audioMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? 'ogg'
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'wav') return 'audio/wav'
  return 'audio/ogg'
}

type AudioAssetCardProps = Readonly<{
  asset: AudioAsset
  projectRoot: string | null
}>

function AudioAssetCard({ asset, projectRoot }: AudioAssetCardProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!projectRoot) {
      setSrc(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    void readProjectFileBytes(projectRoot, asset.path).then((bytes) => {
      if (cancelled || !bytes || bytes.length === 0) return
      const blob = new Blob([bytes], { type: audioMimeFromPath(asset.path) })
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [projectRoot, asset.path])

  return (
    <div
      className={`${CARD_BTN} border-[var(--border)]`}
      title={asset.path}
    >
      {src ? (
        <audio controls src={src} className="w-full h-8" preload="metadata" />
      ) : (
        <AssetIcon type="AUDIO" />
      )}
      <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
        {asset.name}
      </span>
    </div>
  )
}

function ImageAssetCard({
  asset,
  selected,
  entityName,
  onSelect,
  onAssign,
}: ImageAssetCardProps) {
  const title = entityName
    ? `Double-click → assign as sprite of "${entityName}"`
    : 'Select an entity, then double-click to assign as its sprite'

  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onAssign}
      title={title}
      className={`${CARD_BTN} ${
        selected
          ? 'border-[var(--accent)] ring-1 ring-[rgb(var(--accent-rgb)/0.35)]'
          : 'border-[var(--border)] hover:border-[rgb(var(--accent-rgb)/0.5)]'
      }`}
    >
      <div className="w-[22px] h-[22px] flex items-center justify-center group-hover:scale-110 transition-transform">
        {asset.dataUrl ? (
          <img
            src={asset.dataUrl}
            alt={asset.name}
            className="max-w-full max-h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <AssetIcon type="IMAGES" />
        )}
      </div>
      <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
        {asset.name}
      </span>
      <span className="text-[8px] text-[rgb(var(--muted-rgb)/0.5)]">image</span>
    </button>
  )
}

type TilesetAssetCardProps = Readonly<{
  tileset: TilesetAsset
  onOpen: () => void
}>

function TilesetAssetCard({ tileset, onOpen }: TilesetAssetCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Open "${tileset.name}" in the Tileset Editor`}
      className={`${CARD_BTN} border-[var(--border)] hover:border-[var(--purple)] hover:bg-[var(--panel-3)]`}
    >
      <div className="w-[22px] h-[22px] flex items-center justify-center group-hover:scale-110 transition-transform">
        <AssetIcon type="TILESETS" />
      </div>
      <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
        {tileset.name}
      </span>
      <span className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] tabular-nums">
        {tileset.tileSize}px · {tileset.cols}×{tileset.rows}
      </span>
    </button>
  )
}

type ImagePointsEditorProps = Readonly<{
  asset: ImageAsset
  onPatchPoints: (points: ImagePointDef[]) => void
  onRemove: () => void
}>

function ImagePointsEditor({ asset, onPatchPoints, onRemove }: ImagePointsEditorProps) {
  const points = asset.imagePoints ?? []

  return (
    <div className="mt-4 p-3 rounded border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Image points — {asset.name}
        </p>
        <button
          type="button"
          onClick={onRemove}
          title="Remove image (Delete)"
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px]
                     text-[var(--muted)] hover:text-[var(--danger)]"
        >
          <Trash2 size={11} /> Remove
        </button>
      </div>
      <ul className="space-y-1 mb-2">
        {points.map((pt, i) => (
          <li key={pt.id || i} className="flex gap-2 items-center text-xs">
            <input
              className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-20"
              value={pt.id}
              placeholder="id"
              onChange={(e) => {
                const next = [...points]
                next[i] = { ...pt, id: e.target.value }
                onPatchPoints(next)
              }}
            />
            <input
              type="number"
              step="0.01"
              className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-14"
              value={pt.x}
              onChange={(e) => {
                const next = [...points]
                next[i] = { ...pt, x: Number.parseFloat(e.target.value) || 0 }
                onPatchPoints(next)
              }}
            />
            <input
              type="number"
              step="0.01"
              className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1 w-14"
              value={pt.y}
              onChange={(e) => {
                const next = [...points]
                next[i] = { ...pt, y: Number.parseFloat(e.target.value) || 0 }
                onPatchPoints(next)
              }}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="text-[10px] text-[var(--accent)]"
        onClick={() => {
          onPatchPoints([
            ...points,
            { id: `point_${points.length + 1}`, x: 0.5, y: 0.5 },
          ])
        }}
      >
        + Add point
      </button>
    </div>
  )
}

export default function AssetBrowserPanel() {
  const { state, dispatch } = useEditor()
  const [cat, setCat] = useState<Category>('ALL')
  const [msg, setMsg] = useState<string | null>(null)
  const [selAssetId, setSelAssetId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const project = state.project
  const images = Object.values(project?.assets ?? {})
  const audioFiles = Object.values(project?.audioAssets ?? {})
  const tilesets = Object.values(project?.tilesets ?? {}) as TilesetAsset[]
  const audioRef = useRef<HTMLInputElement>(null)
  const selEntity =
    project && state.selection.entityId != null
      ? project.entities[state.selection.entityId]
      : null

  const flash = useCallback((text: string) => {
    setMsg(text)
    globalThis.setTimeout(() => setMsg(null), 3000)
  }, [])

  const patchAssetPoints = useCallback(
    (assetId: string, points: ImagePointDef[]) => {
      const asset = project?.assets?.[assetId]
      if (!asset) return
      dispatch({ type: 'ASSET_ADD', asset: { ...asset, imagePoints: points } })
    },
    [project, dispatch],
  )

  const selAsset = selAssetId ? project?.assets?.[selAssetId] : undefined
  const canRemove = Boolean(selAssetId && project?.assets?.[selAssetId])

  const removeSelectedAsset = useCallback(() => {
    if (!selAssetId || !project?.assets?.[selAssetId]) return
    const name = project.assets[selAssetId].name
    dispatch({ type: 'ASSET_REMOVE', assetId: selAssetId })
    setSelAssetId(null)
    flash(`Removed ${name}`)
  }, [selAssetId, project, dispatch, flash])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && !isBackspaceKey(e)) return
      const focus = keyboardFocusElement(e)
      if (!focus || !isInsidePanel(focus, 'assets')) return
      if (shouldIgnoreEditorShortcut(e)) return
      if (!selAssetId || !project?.assets?.[selAssetId]) return
      e.preventDefault()
      removeSelectedAsset()
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [selAssetId, project, removeSelectedAsset])

  const onPickFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !project) return
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = fileReaderDataUrl(reader.result)
        const buf = await file.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let relPath: string | null = null
        if (state.projectPath) {
          relPath = await importImageIntoProject(
            dirName(state.projectPath),
            file.name,
            bytes,
          )
        }
        const path = relPath ?? `assets/images/${file.name}`
        const asset: ImageAsset = {
          id: `img_${Date.now().toString(36)}`,
          name: file.name,
          path,
          dataUrl,
        }
        dispatch({ type: 'ASSET_ADD', asset })
        flash(relPath ? `Imported ${file.name}` : `${file.name} (save project to persist)`)
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [project, state.projectPath, dispatch, flash],
  )

  const assignSprite = useCallback(
    (asset: ImageAsset) => {
      if (!selEntity) {
        flash('Select an entity first, then double-click an image')
        return
      }
      dispatch({
        type: 'ENTITY_SET_SPRITE',
        entityId: selEntity.id,
        sprite: { ...selEntity.sprite, spriteAssetId: asset.path },
      })
      flash(`Sprite "${asset.name}" → ${selEntity.name}`)
    },
    [selEntity, dispatch, flash],
  )

  const openTilesetEditor = useCallback(
    (t: TilesetAsset) => {
      dispatch({ type: 'TILESET_EDIT_OPEN', tilesetId: t.assetId })
    },
    [dispatch],
  )

  const onPickAudio = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !project) return
      void (async () => {
        const bytes = new Uint8Array(await file.arrayBuffer())
        let relPath: string | null = null
        if (state.projectPath) {
          relPath = await importAudioIntoProject(dirName(state.projectPath), file.name, bytes)
        }
        const path = relPath ?? `assets/audio/${file.name}`
        const asset: AudioAsset = {
          id: `aud_${Date.now().toString(36)}`,
          name: file.name,
          path,
          category: 'sfx',
        }
        dispatch({ type: 'AUDIO_ASSET_ADD', asset })
        flash(relPath ? `Imported ${file.name}` : `${file.name} (save project to persist)`)
      })()
      e.target.value = ''
    },
    [project, state.projectPath, dispatch, flash],
  )

  const showImages = cat === 'ALL' || cat === 'IMAGES'
  const showAudio = cat === 'ALL' || cat === 'AUDIO'
  const showTilesets = cat === 'ALL' || cat === 'TILESETS'
  const hasImages = images.length > 0
  const hasTilesets = tilesets.length > 0
  const hasAudio = audioFiles.length > 0
  const showEmpty = categoryShowsEmpty(cat, project, hasImages, hasTilesets, hasAudio)

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]" data-panel="assets">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={onPickFile}
      />
      <input
        ref={audioRef}
        type="file"
        accept="audio/ogg,audio/wav,audio/mpeg,.ogg,.wav,.mp3"
        className="hidden"
        onChange={onPickAudio}
      />

      <div className="flex items-center border-b border-[var(--border)] px-2 flex-shrink-0">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`px-4 py-2 text-[10px] font-bold tracking-wider transition-colors whitespace-nowrap border-b-2 ${
              cat === c
                ? 'border-[var(--accent-2)] text-[var(--text)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
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
        {(cat === 'AUDIO' || cat === 'ALL') && (
          <button
            type="button"
            onClick={() => audioRef.current?.click()}
            disabled={!project}
            className="flex items-center gap-1.5 px-3 py-1 my-1 mr-1 rounded text-[10px] font-semibold
                       border border-[var(--border-2)] text-[var(--muted)]
                       hover:text-[var(--text)] disabled:opacity-40"
          >
            <Music size={12} /> Import audio
          </button>
        )}
        {(cat === 'IMAGES' || cat === 'ALL') && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!project}
            className="flex items-center gap-1.5 px-3 py-1 my-1 rounded text-[10px] font-semibold
                       border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]
                       hover:bg-[var(--accent-bg-h)] disabled:opacity-40"
          >
            <ImagePlus size={12} /> Import image
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {showEmpty && (
          <p className="text-[var(--muted)] text-[10px] mb-3 leading-relaxed">
            {emptyCategoryMessage(cat, project)}
          </p>
        )}
        <div className="grid grid-cols-6 gap-3">
          {showImages &&
            images.map((asset) => (
              <ImageAssetCard
                key={asset.id}
                asset={asset}
                selected={selAssetId === asset.id}
                entityName={selEntity?.name ?? null}
                onSelect={() => setSelAssetId(asset.id)}
                onAssign={() => assignSprite(asset)}
              />
            ))}

          {showAudio &&
            audioFiles.map((a) => (
              <AudioAssetCard
                key={a.id}
                asset={a}
                projectRoot={state.projectPath ? dirName(state.projectPath) : null}
              />
            ))}

          {showTilesets &&
            tilesets.map((t) => (
              <TilesetAssetCard
                key={t.assetId}
                tileset={t}
                onOpen={() => openTilesetEditor(t)}
              />
            ))}
        </div>

      {selAsset && (
        <>
          <ImagePointsEditor
            asset={selAsset}
            onPatchPoints={(points) => patchAssetPoints(selAsset.id, points)}
            onRemove={removeSelectedAsset}
          />
          <AnimationClipsEditor
            asset={selAsset}
            onPatch={(clips: AnimationClipDef[]) => {
              dispatch({ type: 'ASSET_ADD', asset: { ...selAsset, clips } })
            }}
          />
        </>
      )}
      </div>
    </div>
  )
}

