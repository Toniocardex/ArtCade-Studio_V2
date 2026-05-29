import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Grid3x3,
  Image,
  Music,
  Pencil,
  Plus,
  Star,
  Trash2,
  Type,
  Workflow,
} from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import { assetFolderItemCount, buildProjectExplorerData } from '../../utils/project-explorer-tree'
import { useExplorerExpanded } from '../../hooks/useExplorerExpanded'
import { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import { ProjectSearch } from './ProjectSearch'
import { TreeSection } from './TreeSection'
import { TreeFolder, TreeLeaf } from './TreeNode'
import { AssetToolbar } from './AssetToolbar'
import { AssetDetailStrip } from '../asset-explorer/AssetDetailStrip'

const CLASS_COLOR: Record<string, string> = {
  Player: 'var(--accent)',
  Tilemap: 'var(--muted)',
  Slime: 'var(--green-2)',
  Enemy: 'var(--danger)',
}

export default function ProjectExplorerPanel() {
  const { state } = useEditor()
  const [search, setSearch] = useState('')
  const assetsAnchorRef = useRef<HTMLDivElement>(null)
  const { isOpen, toggle, setOpen, expandAllAssetFolders } = useExplorerExpanded()
  const scene = useSceneExplorerActions()
  const assets = useAssetExplorerActions()

  const sceneId = scene.sceneId
  const project = scene.project
  const openScriptPaths = useMemo(
    () => state.openScripts.map((s) => s.path).join('\0'),
    [state.openScripts],
  )

  const tree = useMemo(() => {
    if (!project) return null
    const extra = openScriptPaths ? openScriptPaths.split('\0') : []
    return buildProjectExplorerData(project, sceneId, search, extra)
  }, [project, sceneId, search, openScriptPaths])

  const totalAssets = useMemo(() => {
    if (!tree) return 0
    return tree.assetFolders.reduce((n, f) => n + assetFolderItemCount(f), 0)
  }, [tree])

  const prevTypeCountRef = useRef(0)
  const prevAssetCountRef = useRef(0)

  useEffect(() => {
    prevTypeCountRef.current = 0
    prevAssetCountRef.current = 0
  }, [state.projectLoadEpoch])

  useEffect(() => {
    if (!tree) return
    if (tree.entityTypes.length > 0 && prevTypeCountRef.current === 0) {
      setOpen('entityTypes', true)
    }
    prevTypeCountRef.current = tree.entityTypes.length
  }, [tree, setOpen])

  useEffect(() => {
    if (totalAssets > 0 && prevAssetCountRef.current === 0) {
      setOpen('assets', true)
    }
    prevAssetCountRef.current = totalAssets
  }, [totalAssets, setOpen])

  const focusAssets = () => {
    expandAllAssetFolders()
    assetsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!project || !tree) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--panel)]">
        <span className="text-[var(--muted)] text-xs">No project</span>
      </div>
    )
  }

  const sel = scene.selection
  const selectedEntityId = sel.entityId

  return (
    <div
      className="h-full min-h-0 flex flex-col bg-[var(--panel)]"
      data-panel="project-explorer"
    >
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

      <ProjectSearch value={search} onChange={setSearch} />

      <div className="flex flex-col flex-1 min-h-0">
        <div className="panel-scroll flex-[3] min-h-0">
        <TreeSection
          title="Scenes"
          open={isOpen('scenes')}
          onToggle={() => toggle('scenes')}
          hidden={!tree.scenesVisible}
          actions={
            <div className="flex items-center gap-0.5">
              {scene.scene ? (
                <>
                  <button
                    type="button"
                    disabled={scene.isStartScene}
                    onClick={scene.setStartScene}
                    title="Set as start scene"
                    className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] disabled:opacity-40"
                  >
                    <Star size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={scene.renameScene}
                    title="Rename scene"
                    className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)]"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={!scene.canDeleteScene}
                    onClick={scene.deleteScene}
                    title="Delete scene"
                    className="p-1 rounded text-[var(--muted)] hover:text-[var(--danger)] disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={scene.addScene}
                title="Create scene"
                className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)]"
              >
                <Plus size={12} />
              </button>
            </div>
          }
        >
          {tree.scenes.length === 0 ? (
            <p className="text-[10px] text-[var(--muted)] italic px-2 py-1">No matches</p>
          ) : (
            tree.scenes.map((s) => {
              const active = sceneId === s.sceneId
              return (
                <TreeLeaf
                  key={s.sceneId}
                  label={s.name}
                  depth={1}
                  selected={active}
                  onClick={() => scene.selectScene(s.sceneId)}
                  icon={<FileText size={11} className="flex-shrink-0 opacity-70" />}
                  trailing={
                    s.isStartScene ? (
                      <Star size={10} fill="currentColor" className="flex-shrink-0 opacity-90" />
                    ) : null
                  }
                />
              )
            })
          )}
        </TreeSection>

        <TreeSection
          title="Entities"
          open={isOpen('entities')}
          onToggle={() => toggle('entities')}
          hidden={!tree.entitiesVisible}
          bodyClassName={tree.entities.length === 0 ? 'min-h-[3.25rem]' : ''}
          actions={
            <button
              type="button"
              onClick={scene.addEntity}
              disabled={!scene.scene}
              title="Add entity (Insert)"
              className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] disabled:opacity-40"
            >
              <Plus size={12} />
            </button>
          }
        >
          {tree.entities.length === 0 ? (
            <p className="text-[10px] text-[var(--muted)] italic px-2 py-1">
              {tree.hasSearch
                ? 'No matches'
                : scene.scene
                  ? 'No entities in this scene'
                  : 'No active scene'}
            </p>
          ) : (
            tree.entities.map((e) => {
              const entity = project.entities[e.entityId]
              const color = entity ? (CLASS_COLOR[entity.className] ?? 'var(--muted)') : 'var(--muted)'
              const selected = selectedEntityId === e.entityId
              const actionBtnClass =
                'p-1 rounded hover:bg-[rgb(var(--bg-rgb)/0.15)] text-[var(--bg)] flex-shrink-0'

              return (
                <TreeLeaf
                  key={e.entityId}
                  label={e.name}
                  depth={1}
                  selected={selected}
                  muted={!e.visible}
                  onClick={() => scene.selectEntity(e.entityId)}
                  icon={
                    <Box
                      size={11}
                      style={{ color: selected ? 'var(--bg)' : color }}
                      className="flex-shrink-0"
                    />
                  }
                  trailing={
                    !selected && e.hasLogic ? (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--accent)]"
                        title="Has Logic Board rules"
                      />
                    ) : null
                  }
                  actions={
                    selected ? (
                      <>
                        <button
                          type="button"
                          title="Edit logic"
                          className={actionBtnClass}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            scene.openEntityLogic(e.entityId)
                          }}
                        >
                          <Workflow size={12} />
                        </button>
                        <button
                          type="button"
                          title={e.visible ? 'Hide in game' : 'Show in game'}
                          className={actionBtnClass}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            scene.toggleEntityVisible(e.entityId, e.visible)
                          }}
                        >
                          {e.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button
                          type="button"
                          title="Duplicate"
                          className={actionBtnClass}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            scene.duplicateEntity(e.entityId)
                          }}
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          className={actionBtnClass}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            scene.deleteEntity(e.entityId)
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    ) : undefined
                  }
                />
              )
            })
          )}
        </TreeSection>

        <TreeSection
          title="Entity Types"
          open={isOpen('entityTypes')}
          onToggle={() => toggle('entityTypes')}
          hidden={!tree.entityTypesVisible}
          actions={
            <button
              type="button"
              onClick={scene.addEntityType}
              title="New entity type"
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-2)]
                         hover:border-[var(--accent-bd)]"
            >
              <Plus size={10} className="inline" /> New
            </button>
          }
        >
          {tree.entityTypes.length === 0 ? (
            <p className="text-[10px] text-[var(--muted)] italic px-2 py-1">
              No types yet — + New for reusable templates.
            </p>
          ) : (
            tree.entityTypes.map((t) => (
              <div
                key={t.objectTypeId}
                className="flex items-center gap-1 px-2 py-0.5"
                style={{ paddingLeft: 20 }}
              >
                <span className="flex-1 text-[10px] truncate text-[var(--text)]" title={t.objectTypeId}>
                  {t.label}
                </span>
                <button
                  type="button"
                  disabled={!scene.scene}
                  onClick={() => scene.placeEntityType(t.objectTypeId)}
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--accent-bd)]
                             bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]
                             disabled:opacity-40"
                >
                  Place
                </button>
              </div>
            ))
          )}
        </TreeSection>
        </div>

        <div ref={assetsAnchorRef} className="panel-scroll flex-[2] min-h-0 border-t border-[var(--border)]">
          <TreeSection
            title="Assets"
            open={isOpen('assets')}
            onToggle={() => toggle('assets')}
            hidden={!tree.assetsVisible}
          >
            <AssetToolbar
              disabled={!project}
              canRemove={assets.canRemove}
              onNewFolder={() => {}}
              onImportImage={assets.triggerImportImage}
              onImportAudio={assets.triggerImportAudio}
              onImportFont={assets.triggerImportFont}
              onFocusAssets={focusAssets}
              onRemove={assets.removeSelection}
            />
            {assets.flash ? (
              <p
                key={assets.flash}
                className="asset-flash-msg text-[9px] text-[var(--muted)] px-2 pb-1"
                onAnimationEnd={assets.clearFlash}
              >
                {assets.flash}
              </p>
            ) : null}

            {tree.assetFolders.map((folder) => {
                const folderKey = `asset:${folder.id}` as const
                const folderOpen = isOpen(folderKey) || tree.hasSearch
                return (
                  <TreeFolder
                    key={folder.id}
                    label={folder.label}
                    count={folder.count}
                    depth={1}
                    open={folderOpen}
                    onToggle={() => toggle(folderKey)}
                  >
                    {folder.count === 0 ? (
                      <p className="text-[10px] text-[var(--muted)] italic py-1 pl-4">
                        No assets in this category yet.
                      </p>
                    ) : null}
                    {folder.images.map((img) => {
                      const asset = project.assets?.[img.id]
                      const selected =
                        assets.selection?.type === 'image' && assets.selection.id === img.id
                      return (
                        <TreeLeaf
                          key={img.id}
                          label={img.name}
                          depth={2}
                          selected={selected}
                          onClick={() => assets.setSelection({ type: 'image', id: img.id })}
                          onDoubleClick={() => asset && assets.assignSprite(asset)}
                          title={asset ? 'Double-click to assign sprite to selected entity' : img.path}
                          icon={
                            asset?.dataUrl ? (
                              <img
                                src={asset.dataUrl}
                                alt=""
                                className="w-4 h-4 object-contain flex-shrink-0"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            ) : (
                              <Image size={11} className="flex-shrink-0 text-[var(--accent)]" />
                            )
                          }
                        />
                      )
                    })}
                    {folder.audio.map((a) => (
                      <TreeLeaf
                        key={a.id}
                        label={a.name}
                        depth={2}
                        selected={
                          assets.selection?.type === 'audio' && assets.selection.id === a.id
                        }
                        onClick={() => assets.setSelection({ type: 'audio', id: a.id })}
                        icon={<Music size={11} className="flex-shrink-0 text-[var(--accent-2)]" />}
                        title={a.path}
                      />
                    ))}
                    {folder.fonts.map((f) => (
                      <TreeLeaf
                        key={f.id}
                        label={f.name}
                        depth={2}
                        selected={
                          assets.selection?.type === 'font' && assets.selection.id === f.id
                        }
                        onClick={() => assets.setSelection({ type: 'font', id: f.id })}
                        icon={<Type size={11} className="flex-shrink-0 text-[var(--warn)]" />}
                        title={f.path}
                      />
                    ))}
                    {folder.scripts.map((s) => (
                      <TreeLeaf
                        key={s.path}
                        label={s.label}
                        depth={2}
                        onClick={() => assets.openScript(s.path)}
                        icon={<FileText size={11} className="flex-shrink-0 text-[var(--muted)]" />}
                        title={s.path}
                      />
                    ))}
                    {folder.tilesets.map((t) => (
                      <TreeLeaf
                        key={t.assetId}
                        label={t.name}
                        depth={2}
                        selected={
                          assets.selection?.type === 'tileset' && assets.selection.id === t.assetId
                        }
                        onClick={() => assets.setSelection({ type: 'tileset', id: t.assetId })}
                        onDoubleClick={() => assets.openTilesetEditor(t.assetId)}
                        icon={<Grid3x3 size={11} className="flex-shrink-0 text-[var(--purple)]" />}
                        title="Double-click to open Tileset Editor"
                      />
                    ))}
                  </TreeFolder>
                )
              })}
          </TreeSection>
          {assets.selection?.type === 'image' ? (
            <AssetDetailStrip selection={assets.selection} />
          ) : null}
        </div>
      </div>

      <div className="px-2 py-1 border-t border-[var(--border)] text-[9px] text-[var(--muted)] flex-shrink-0">
        {scene.sceneCount} scenes · {tree.entities.length} entities · {tree.entityTypes.length} types
      </div>
    </div>
  )
}
