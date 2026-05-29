// Tabbed thumbnail grid — uses useAssetExplorerActions (same as ProjectExplorerPanel).
import { useState } from 'react'
import { ImagePlus, Music, Trash2, Type } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import { dirName } from '../../utils/project'
import type { ProjectDoc, TilesetAsset } from '../../types'
import { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import { AssetDetailStrip } from './AssetDetailStrip'
import { assetRemoveTitle } from './asset-explorer-labels'
import {
  AudioAssetCard,
  FontAssetCard,
  ImageAssetCard,
  TilesetAssetCard,
} from './asset-browser-cards'

type Category = 'ALL' | 'IMAGES' | 'AUDIO' | 'FONTS' | 'SCRIPTS' | 'TILESETS'

const CATEGORIES: Category[] = ['ALL', 'IMAGES', 'AUDIO', 'FONTS', 'SCRIPTS', 'TILESETS']

const importBtnBase =
  'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold'
const importBtnAccent =
  `${importBtnBase} border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)] disabled:opacity-40`
const importBtnMuted =
  `${importBtnBase} border border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40`

function categoryShowsEmpty(
  cat: Category,
  project: ProjectDoc | null,
  hasImages: boolean,
  hasTilesets: boolean,
  hasAudio: boolean,
  hasFonts: boolean,
): boolean {
  if (!project) return true
  if (cat === 'ALL') return !hasImages && !hasTilesets && !hasAudio && !hasFonts
  if (cat === 'IMAGES') return !hasImages
  if (cat === 'TILESETS') return !hasTilesets
  if (cat === 'AUDIO') return !hasAudio
  if (cat === 'FONTS') return !hasFonts
  return true
}

function emptyCategoryMessage(cat: Category, project: ProjectDoc | null): string {
  if (!project) {
    return 'No project loaded — use File → New Project or Open Project.'
  }
  if (cat === 'IMAGES') {
    return 'No images yet — click Import image above. Double-click (with an entity selected) to assign a sprite.'
  }
  if (cat === 'TILESETS') {
    return 'No tilesets yet — create one from the scene tilemap settings, then click here to edit.'
  }
  if (cat === 'AUDIO') {
    return 'No audio yet — click Import audio above.'
  }
  if (cat === 'FONTS') {
    return 'No fonts yet — click Import font above. Draw in Lua with text.draw(path, …).'
  }
  return 'No assets in this category yet.'
}

export default function AssetBrowserGridPanel() {
  const { state } = useEditor()
  const assets = useAssetExplorerActions()
  const [cat, setCat] = useState<Category>('ALL')

  const project = assets.project
  const images = Object.values(project?.assets ?? {})
  const audioFiles = Object.values(project?.audioAssets ?? {})
  const fontFiles = Object.values(project?.fontAssets ?? {})
  const tilesets = Object.values(project?.tilesets ?? {}) as TilesetAsset[]
  const selEntity =
    project && state.selection.entityId != null
      ? project.entities[state.selection.entityId]
      : null

  const showImages = cat === 'ALL' || cat === 'IMAGES'
  const showAudio = cat === 'ALL' || cat === 'AUDIO'
  const showFonts = cat === 'ALL' || cat === 'FONTS'
  const showTilesets = cat === 'ALL' || cat === 'TILESETS'
  const showEmpty = categoryShowsEmpty(
    cat,
    project,
    images.length > 0,
    tilesets.length > 0,
    audioFiles.length > 0,
    fontFiles.length > 0,
  )

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]" data-panel="assets">
      <input
        ref={assets.imageRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={assets.onPickImage}
      />
      <input
        ref={assets.audioRef}
        type="file"
        accept="audio/ogg,audio/wav,audio/mpeg,.ogg,.wav,.mp3"
        className="hidden"
        onChange={assets.onPickAudio}
      />
      <input
        ref={assets.fontRef}
        type="file"
        accept=".ttf,.otf,font/ttf,font/otf"
        className="hidden"
        onChange={assets.onPickFont}
      />

      <div className="flex-shrink-0 border-b border-[var(--border)] pe-2.5">
        <div className="flex flex-wrap items-end gap-x-0.5 gap-y-0 px-1.5 pt-1">
          {CATEGORIES.map((c) => {
            const active = cat === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`relative px-2.5 py-1.5 text-[10px] font-bold tracking-wider transition-colors whitespace-nowrap ${
                  active
                    ? 'text-[var(--text)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {c}
                {active ? (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[var(--accent-2)]"
                    aria-hidden
                  />
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 pe-1 bg-[var(--panel-2)]">
          {assets.flash ? (
            <span
              key={assets.flash}
              className="asset-flash-msg text-[9px] text-[var(--muted)] w-full sm:w-auto"
              onAnimationEnd={assets.clearFlash}
            >
              {assets.flash}
            </span>
          ) : null}
          {(cat === 'IMAGES' || cat === 'ALL') && (
            <button
              type="button"
              onClick={assets.triggerImportImage}
              disabled={!project}
              title="Import PNG, JPEG, or GIF"
              className={importBtnAccent}
            >
              <ImagePlus size={12} /> Import image
            </button>
          )}
          {(cat === 'AUDIO' || cat === 'ALL') && (
            <button
              type="button"
              onClick={assets.triggerImportAudio}
              disabled={!project}
              title="Import OGG, WAV, or MP3"
              className={cat === 'AUDIO' ? importBtnAccent : importBtnMuted}
            >
              <Music size={12} /> Import audio
            </button>
          )}
          {(cat === 'FONTS' || cat === 'ALL') && (
            <button
              type="button"
              onClick={assets.triggerImportFont}
              disabled={!project}
              title="Import TTF or OTF"
              className={cat === 'FONTS' ? importBtnAccent : importBtnMuted}
            >
              <Type size={12} /> Import font
            </button>
          )}
          {cat !== 'SCRIPTS' && (
            <button
              type="button"
              onClick={assets.removeSelection}
              disabled={!assets.canRemove}
              title={assetRemoveTitle(assets.selection)}
              className={`${importBtnMuted} hover:text-[var(--danger)] hover:border-[var(--danger)]`}
            >
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
      </div>

      <div className="panel-scroll flex-1 min-h-0 p-3 pe-2">
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
                selected={assets.selection?.type === 'image' && assets.selection.id === asset.id}
                entityName={selEntity?.name ?? null}
                onSelect={() => assets.setSelection({ type: 'image', id: asset.id })}
                onAssign={() => assets.assignSprite(asset)}
              />
            ))}
          {showAudio &&
            audioFiles.map((a) => (
              <AudioAssetCard
                key={a.id}
                asset={a}
                projectRoot={state.projectPath ? dirName(state.projectPath) : null}
                selected={assets.selection?.type === 'audio' && assets.selection.id === a.id}
                onSelect={() => assets.setSelection({ type: 'audio', id: a.id })}
              />
            ))}
          {showFonts &&
            fontFiles.map((f) => (
              <FontAssetCard
                key={f.id}
                name={f.name}
                path={f.path}
                defaultSize={f.defaultSize}
                selected={assets.selection?.type === 'font' && assets.selection.id === f.id}
                onSelect={() => assets.setSelection({ type: 'font', id: f.id })}
              />
            ))}
          {showTilesets &&
            tilesets.map((t) => (
              <TilesetAssetCard
                key={t.assetId}
                tileset={t}
                selected={assets.selection?.type === 'tileset' && assets.selection.id === t.assetId}
                onSelect={() => assets.setSelection({ type: 'tileset', id: t.assetId })}
                onOpen={() => assets.openTilesetEditor(t.assetId)}
              />
            ))}
        </div>
        {assets.selection?.type === 'image' ? (
          <AssetDetailStrip selection={assets.selection} />
        ) : null}
      </div>
    </div>
  )
}
