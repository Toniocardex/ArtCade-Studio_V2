import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  FileText,
  Grid3x3,
  ImagePlus,
  Music,
  Pencil,
  Plus,
  Star,
  Trash2,
  Type,
  MessageSquare,
} from 'lucide-react'
import { openDialogEditorForId } from '../../panels/dialog/dialog-modal-api'
import { useEditorDispatch, useEditorSelector, useEditorStore } from '../../store/editor-store'
import { assetFolderItemCount, buildProjectExplorerData } from '../../utils/project-explorer-tree'
import { useExplorerExpanded } from '../../hooks/useExplorerExpanded'
import { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import { useAssetFolderActions } from '../../hooks/useAssetFolderActions'
import { useAssetTreeMultiSelect } from '../../hooks/useAssetTreeMultiSelect'
import { useSceneExplorerActions } from '../../hooks/useSceneExplorerActions'
import {
  explorerFolderIdToCategory,
  virtualFolderContainingAsset,
  type AssetVirtualFolderCategory,
  type VirtualAssetRefType,
} from '../../utils/asset-virtual-folders'
import { buildAssetFolderMenuItems, type AssetFolderMenuHandlers } from './asset-folder-context-menus'
import { explorerAssetDragProps } from './explorer-asset-drag'
import {
  AssetTreeDnDRoot,
  libraryCategoryFolderId,
} from './asset-tree-dnd'
import {
  VirtualFoldersBlock,
  assetHiddenByVirtualFolder,
} from './VirtualFoldersBlock'
import { ProjectSearch } from './ProjectSearch'
import { SceneObjectsTree } from './SceneObjectsTree'
import { TreeSection } from './TreeSection'
import { TreeFolder, TreeLeaf } from './TreeNode'
import { AssetToolbar } from './AssetToolbar'
import { AssetDetailStrip } from '../asset-explorer/AssetDetailStrip'
import { AssetMediaDetailStrip } from '../asset-explorer/AssetMediaDetailStrip'
import { ImageTreeThumbnail } from '../asset-explorer/ImageTreeThumbnail'
import { TilesetTreeThumbnail } from '../asset-explorer/TilesetTreeThumbnail'
import {
  ExplorerActionBar,
  ExplorerLabelCta,
} from './explorer-cta'
import {
  ExplorerContextMenu,
  openExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'

export type ExplorerPane = 'scene' | 'assets' | 'all'

export type ProjectExplorerPanelProps = Readonly<{
  explorerPane?: ExplorerPane
}>

export default function ProjectExplorerPanel({ explorerPane = 'all' }: ProjectExplorerPanelProps) {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const openScripts = useEditorSelector((s) => s.openScripts)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const projectLoadEpoch = useEditorSelector((s) => s.projectLoadEpoch)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null)
  const assetsAnchorRef = useRef<HTMLDivElement>(null)
  const { isOpen, toggle, setOpen, allAssetLibraryFoldersExpanded, toggleAllAssetFolders } =
    useExplorerExpanded()
  const scene = useSceneExplorerActions()
  const assets = useAssetExplorerActions()
  const assetFolders = useAssetFolderActions()
  const assetMulti = useAssetTreeMultiSelect()

  const makeAssetFolderMenuHandlers = useCallback(
    (
      category: AssetVirtualFolderCategory,
      type: VirtualAssetRefType,
      id: string,
    ): AssetFolderMenuHandlers => ({
      onMoveToFolder: (folderId) => assetFolders.moveAssetToFolder(folderId, type, id),
      onMoveRefsToFolder: (folderId, refs) =>
        assetFolders.moveRefsToFolder(folderId, refs, { source: 'context-menu' }),
      onUnassign: () => assetFolders.unassignAssetFromFolders(type, id, category),
      onUnassignRefs: (refs) =>
        assetFolders.unassignRefsFromFolders(refs, category, { source: 'context-menu' }),
      onCreateFolder: () => assetFolders.createVirtualFolder(category),
    }),
    [assetFolders],
  )

  useEffect(() => {
    assetMulti.clearMulti()
  }, [search, assetMulti.clearMulti])

  const sceneId = scene.sceneId
  const project = scene.project
  const openScriptPaths = useMemo(
    () => openScripts.map((s) => s.path).join('\0'),
    [openScripts],
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

  const prevAssetCountRef = useRef(0)

  useEffect(() => {
    prevAssetCountRef.current = 0
  }, [projectLoadEpoch])

  useEffect(() => {
    if (totalAssets > 0 && prevAssetCountRef.current === 0) {
      setOpen('assets', true)
    }
    prevAssetCountRef.current = totalAssets
  }, [totalAssets, setOpen])

  const toggleAssetFolderExpansion = () => {
    const expanding = !allAssetLibraryFoldersExpanded
    toggleAllAssetFolders()
    if (expanding) {
      assetsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Keep the group of a canvas-selected instance visible in the tree.
  const selectionEntityId = scene.selection.entityId
  useEffect(() => {
    if (selectionEntityId == null || !tree) return
    const group = tree.entityGroups.find((g) =>
      g.instances.some((row) => row.entityId === selectionEntityId),
    )
    if (group) setOpen(`scene-type:${group.typeKey}`, true)
  }, [selectionEntityId, tree, setOpen])

  if (!project || !tree) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--surface)]">
        <span className="text-[var(--muted)] text-xs">No project</span>
      </div>
    )
  }

  const sel = scene.selection
  const selectedEntityId = sel.entityId
  const showScene = explorerPane === 'all' || explorerPane === 'scene'
  const showAssets = explorerPane === 'all' || explorerPane === 'assets'

  return (
    <div
      className="h-full min-h-0 flex flex-col bg-[var(--panel)]"
      data-panel="project-explorer"
    >
      <ExplorerContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />
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
      <input
        ref={assets.tilesetRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={assets.onPickTileset}
      />

      <ProjectSearch value={search} onChange={setSearch} />

      <div className="flex flex-col flex-1 min-h-0">
        {showScene ? (
        <div className="panel-scroll flex-[3] min-h-0">
        <TreeSection
          title="Scenes"
          open={isOpen('scenes')}
          onToggle={() => toggle('scenes')}
          hidden={!tree.scenesVisible}
          actions={
            <ExplorerLabelCta
              label="Add scene"
              title="Create a new scene"
              onClick={scene.addScene}
              icon={<Plus size={12} />}
            />
          }
          actionBar={
            scene.scene ? (
              <ExplorerActionBar>
                <ExplorerLabelCta
                  label="Set start"
                  title="Set as start scene"
                  tone="default"
                  disabled={scene.isStartScene}
                  onClick={scene.setStartScene}
                  icon={<Star size={12} />}
                />
                <ExplorerLabelCta
                  label="Duplicate"
                  title="Duplicate scene"
                  tone="default"
                  onClick={() => scene.duplicateSceneById(sceneId)}
                  icon={<Copy size={12} />}
                />
                <ExplorerLabelCta
                  label="Rename"
                  title="Rename scene"
                  tone="default"
                  onClick={scene.renameScene}
                  icon={<Pencil size={12} />}
                />
                <ExplorerLabelCta
                  label="Delete"
                  title="Delete scene"
                  tone="default"
                  disabled={!scene.canDeleteScene}
                  onClick={scene.deleteScene}
                  icon={<Trash2 size={12} />}
                />
              </ExplorerActionBar>
            ) : null
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
                  onDoubleClick={() => scene.renameSceneById(s.sceneId)}
                  onContextMenu={(ev) =>
                    openExplorerContextMenu(
                      ev,
                      [
                        {
                          id: 'set-start',
                          label: 'Set as start scene',
                          disabled: s.isStartScene,
                          onSelect: () => scene.setStartSceneById(s.sceneId),
                        },
                        {
                          id: 'duplicate',
                          label: 'Duplicate scene',
                          onSelect: () => scene.duplicateSceneById(s.sceneId),
                        },
                        {
                          id: 'rename',
                          label: 'Rename scene',
                          onSelect: () => scene.renameSceneById(s.sceneId),
                        },
                        {
                          id: 'delete',
                          label: 'Delete scene',
                          danger: true,
                          disabled: s.isStartScene || scene.sceneCount <= 1,
                          onSelect: () => scene.deleteSceneById(s.sceneId),
                        },
                      ],
                      setContextMenu,
                    )
                  }
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
          title="Objects in scene"
          open={isOpen('entities')}
          onToggle={() => toggle('entities')}
          hidden={!tree.entitiesVisible}
          bodyClassName={tree.entityGroups.length === 0 ? 'min-h-[3.25rem]' : ''}
          actions={
            <ExplorerLabelCta
              label="Insert object"
              title="Insert an object into this scene (Insert)"
              onClick={scene.insertObject}
              disabled={!scene.scene}
              icon={<Plus size={12} />}
            />
          }
        >
          {tree.entityGroups.length === 0 ? (
            tree.hasSearch ? (
              <p className="text-[10px] text-[var(--muted)] italic px-2 py-1">No matches</p>
            ) : scene.scene ? (
              <p className="text-[10px] text-[var(--muted)] px-2 py-1">
                No objects yet — use <strong className="font-medium text-[var(--text)]">Insert object</strong> above.
              </p>
            ) : (
              <p className="text-[10px] text-[var(--muted)] italic px-2 py-1">No active scene</p>
            )
          ) : (
            <SceneObjectsTree
              groups={tree.entityGroups}
              hasSearch={tree.hasSearch}
              scene={scene}
              selectedEntityId={selectedEntityId}
              isOpen={isOpen}
              toggle={toggle}
              setContextMenu={setContextMenu}
            />
          )}
        </TreeSection>

        </div>
        ) : null}

        {showAssets ? (
        <div ref={assetsAnchorRef} className="panel-scroll flex-[2] min-h-0 border-t border-[var(--outline)]">
          <TreeSection
            title="Assets"
            open={isOpen('assets')}
            onToggle={() => toggle('assets')}
            hidden={!tree.assetsVisible}
          >
            <AssetToolbar
              disabled={!project}
              canRemove={assets.canRemove}
              onNewFolder={assetFolders.createVirtualFolder}
              onImportImage={assets.triggerImportImage}
              onImportTileset={assets.triggerImportTileset}
              onImportAudio={assets.triggerImportAudio}
              onImportFont={assets.triggerImportFont}
              allAssetFoldersExpanded={allAssetLibraryFoldersExpanded}
              onToggleAssetFoldersExpand={toggleAssetFolderExpansion}
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

            <AssetTreeDnDRoot
              onMoveRefsToFolder={assetFolders.moveRefsToFolder}
              onUnassignRefs={assetFolders.unassignRefsFromFolders}
            >
            {tree.assetFolders.map((folder) => {
                const folderKey = `asset:${folder.id}` as const
                const folderOpen = isOpen(folderKey) || tree.hasSearch
                const libraryCategory = explorerFolderIdToCategory(folder.id)
                const folderHandlers = libraryCategory
                  ? {
                      onMoveToFolder: assetFolders.moveAssetToFolder,
                      onUnassign: (type: VirtualAssetRefType, id: string) =>
                        assetFolders.unassignAssetFromFolders(type, id, libraryCategory),
                      onCreateFolder: () => assetFolders.createVirtualFolder(libraryCategory),
                      onDeleteFolder: assetFolders.deleteVirtualFolder,
                    }
                  : null
                return (
                  <TreeFolder
                    key={folder.id}
                    label={folder.label}
                    count={folder.count}
                    depth={1}
                    assetFolderId={
                      libraryCategory ? libraryCategoryFolderId(libraryCategory) : undefined
                    }
                    open={folderOpen}
                    onToggle={() => {
                      toggle(folderKey)
                    }}
                  >
                    {folder.count === 0 ? (
                      <div className="flex flex-col items-start gap-1.5 py-1.5 pl-4">
                        <p className="text-[10px] text-[var(--muted)]">No assets yet.</p>
                        {libraryCategory === 'images' ? (
                          <button type="button" onClick={assets.triggerImportImage}
                            className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline">
                            <ImagePlus size={10} />Import image
                          </button>
                        ) : libraryCategory === 'tilesets' ? (
                          <button type="button" onClick={assets.triggerImportTileset}
                            className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline">
                            <Grid3x3 size={10} />Import tileset
                          </button>
                        ) : libraryCategory === 'audio' ? (
                          <button type="button" onClick={assets.triggerImportAudio}
                            className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline">
                            <Music size={10} />Import audio
                          </button>
                        ) : libraryCategory === 'fonts' ? (
                          <button type="button" onClick={assets.triggerImportFont}
                            className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline">
                            <Type size={10} />Import font
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {libraryCategory && folderHandlers ? (
                      <VirtualFoldersBlock
                        project={project}
                        category={libraryCategory}
                        folders={assetFolders.foldersForCategory(libraryCategory)}
                        depth={2}
                        isOpen={isOpen}
                        toggle={toggle}
                        setContextMenu={setContextMenu}
                        folderMenuHandlers={(type, id) =>
                          makeAssetFolderMenuHandlers(libraryCategory, type, id)
                        }
                        batchRefs={assetMulti.batchRefsInCategory(libraryCategory)}
                        onRenameFolder={assetFolders.renameVirtualFolder}
                        onDeleteFolder={folderHandlers.onDeleteFolder}
                        resolveLeaf={(type, id) => {
                          if (type === 'image') {
                            const imgRow = folder.images.find((i) => i.id === id)
                            if (!imgRow) return null
                            const asset = project.assets?.[imgRow.id]
                            return {
                              assetType: 'image',
                              assetId: imgRow.id,
                              label: imgRow.name,
                              selected: assetMulti.isSelected('image', imgRow.id),
                              onClick: (e) =>
                                assetMulti.handleAssetClick(
                                  e,
                                  'images',
                                  'image',
                                  imgRow.id,
                                  () => assets.setSelection({ type: 'image', id: imgRow.id }),
                                ),
                              onDoubleClick: asset
                                ? () => assets.openImageStudio(imgRow.id)
                                : undefined,
                              ...explorerAssetDragProps(
                                assetMulti.dragRefsFor('images', 'image', imgRow.id),
                                virtualFolderContainingAsset(project, libraryCategory, 'image', imgRow.id)?.id ?? null,
                              ),
                              title: asset
                                ? 'Double-click to open Sprite Studio'
                                : imgRow.path,
                              icon: (
                                <ImageTreeThumbnail
                                  asset={asset}
                                  projectPath={projectPath}
                                  onOpenStudio={() => assets.openImageStudio(imgRow.id)}
                                />
                              ),
                              spritesheetStudioTrigger: Boolean(asset),
                              extraMenuItems: asset
                                ? [
                                    {
                                      id: 'spritesheet-studio',
                                      label: 'Open Sprite Studio',
                                      onSelect: () => assets.openImageStudio(imgRow.id),
                                    },
                                    {
                                      id: 'assign',
                                      label: 'Assign to selected entity',
                                      disabled: selectedEntityId == null,
                                      onSelect: () => assets.assignSprite(asset),
                                    },
                                    {
                                      id: 'remove',
                                      label: 'Remove image',
                                      danger: true,
                                      onSelect: () =>
                                        dispatch({ type: 'ASSET_REMOVE', assetId: imgRow.id }),
                                    },
                                  ]
                                : [],
                            }
                          }
                          if (type === 'audio') {
                            const row = folder.audio.find((a) => a.id === id)
                            if (!row) return null
                            return {
                              assetType: 'audio',
                              assetId: row.id,
                              label: row.name,
                              selected: assetMulti.isSelected('audio', row.id),
                              onClick: (e) =>
                                assetMulti.handleAssetClick(e, 'audio', 'audio', row.id, () =>
                                  assets.setSelection({ type: 'audio', id: row.id }),
                                ),
                              ...explorerAssetDragProps(
                                assetMulti.dragRefsFor('audio', 'audio', row.id),
                                virtualFolderContainingAsset(project, libraryCategory, 'audio', row.id)?.id ?? null,
                              ),
                              icon: (
                                <Music size={11} className="flex-shrink-0 text-[var(--muted)]" />
                              ),
                              title: row.path,
                              extraMenuItems: [
                                {
                                  id: 'remove',
                                  label: 'Remove audio',
                                  danger: true,
                                  onSelect: () =>
                                    dispatch({ type: 'AUDIO_ASSET_REMOVE', assetId: row.id }),
                                },
                              ],
                            }
                          }
                          if (type === 'font') {
                            const row = folder.fonts.find((f) => f.id === id)
                            if (!row) return null
                            return {
                              assetType: 'font',
                              assetId: row.id,
                              label: row.name,
                              selected: assetMulti.isSelected('font', row.id),
                              onClick: (e) =>
                                assetMulti.handleAssetClick(e, 'fonts', 'font', row.id, () =>
                                  assets.setSelection({ type: 'font', id: row.id }),
                                ),
                              ...explorerAssetDragProps(
                                assetMulti.dragRefsFor('fonts', 'font', row.id),
                                virtualFolderContainingAsset(project, libraryCategory, 'font', row.id)?.id ?? null,
                              ),
                              icon: <Type size={11} className="flex-shrink-0 text-[var(--warn)]" />,
                              title: row.path,
                              extraMenuItems: [
                                {
                                  id: 'remove',
                                  label: 'Remove font',
                                  danger: true,
                                  onSelect: () =>
                                    dispatch({ type: 'FONT_ASSET_REMOVE', assetId: row.id }),
                                },
                              ],
                            }
                          }
                          const row = folder.tilesets.find((t) => t.assetId === id)
                          if (!row) return null
                          const tilesetAsset = project.tilesets?.[row.assetId]
                          return {
                            assetType: 'tileset',
                            assetId: row.assetId,
                            label: row.name,
                            selected: assetMulti.isSelected('tileset', row.assetId),
                            onClick: (e) =>
                              assetMulti.handleAssetClick(
                                e,
                                'tilesets',
                                'tileset',
                                row.assetId,
                                () => assets.openTilesetEditor(row.assetId),
                              ),
                            ...explorerAssetDragProps(
                              assetMulti.dragRefsFor('tilesets', 'tileset', row.assetId),
                              virtualFolderContainingAsset(project, libraryCategory, 'tileset', row.assetId)?.id ?? null,
                            ),
                            icon: (
                              <TilesetTreeThumbnail
                                tileset={tilesetAsset}
                                projectPath={projectPath}
                                onOpenEditor={() => assets.openTilesetEditor(row.assetId)}
                              />
                            ),
                            title: 'Click to open Tileset Editor',
                            extraMenuItems: [
                              {
                                id: 'edit',
                                label: 'Open Tileset Editor',
                                onSelect: () => assets.openTilesetEditor(row.assetId),
                              },
                              {
                                id: 'remove',
                                label: 'Remove tileset',
                                danger: true,
                                onSelect: () =>
                                  dispatch({
                                    type: 'TILESET_ASSET_REMOVE',
                                    assetId: row.assetId,
                                  }),
                              },
                            ],
                          }
                        }}
                      />
                    ) : null}
                    {folder.images
                      .filter(
                        (img) =>
                          !assetHiddenByVirtualFolder(project, 'images', 'image', img.id),
                      )
                      .map((img) => {
                      const asset = project.assets?.[img.id]
                      return (
                        <TreeLeaf
                          key={img.id}
                          label={img.name}
                          depth={2}
                          selected={assetMulti.isSelected('image', img.id)}
                          spritesheetStudioTrigger={Boolean(asset)}
                          {...explorerAssetDragProps(
                            assetMulti.dragRefsFor('images', 'image', img.id),
                          )}
                          onClick={(e) =>
                            assetMulti.handleAssetClick(
                              e,
                              'images',
                              'image',
                              img.id,
                              () => assets.setSelection({ type: 'image', id: img.id }),
                            )
                          }
                          onDoubleClick={
                            asset ? () => assets.openImageStudio(img.id) : undefined
                          }
                          onContextMenu={(ev) => {
                            if (!asset) return
                            openExplorerContextMenu(
                              ev,
                              buildAssetFolderMenuItems(
                                project,
                                'images',
                                'image',
                                img.id,
                                makeAssetFolderMenuHandlers('images', 'image', img.id),
                                [
                                  {
                                    id: 'spritesheet-studio',
                                    label: 'Open Sprite Studio',
                                    onSelect: () => assets.openImageStudio(img.id),
                                  },
                                  {
                                    id: 'assign',
                                    label: 'Assign to selected entity',
                                    disabled: selectedEntityId == null,
                                    onSelect: () => assets.assignSprite(asset),
                                  },
                                  {
                                    id: 'remove',
                                    label: 'Remove image',
                                    danger: true,
                                    onSelect: () =>
                                      dispatch({ type: 'ASSET_REMOVE', assetId: img.id }),
                                  },
                                ],
                                assetMulti.batchRefsInCategory('images'),
                              ),
                              setContextMenu,
                            )
                          }}
                          title={
                            asset ? 'Double-click to open Sprite Studio' : img.path
                          }
                          icon={
                            <ImageTreeThumbnail
                              asset={asset}
                              projectPath={projectPath}
                              onOpenStudio={() => assets.openImageStudio(img.id)}
                            />
                          }
                        />
                      )
                    })}
                    {folder.audio
                      .filter(
                        (a) => !assetHiddenByVirtualFolder(project, 'audio', 'audio', a.id),
                      )
                      .map((a) => (
                      <TreeLeaf
                        key={a.id}
                        label={a.name}
                        depth={2}
                        selected={assetMulti.isSelected('audio', a.id)}
                        {...explorerAssetDragProps(
                          assetMulti.dragRefsFor('audio', 'audio', a.id),
                        )}
                        onClick={(e) =>
                          assetMulti.handleAssetClick(e, 'audio', 'audio', a.id, () =>
                            assets.setSelection({ type: 'audio', id: a.id }),
                          )
                        }
                        onContextMenu={(ev) =>
                          openExplorerContextMenu(
                            ev,
                            buildAssetFolderMenuItems(
                              project,
                              'audio',
                              'audio',
                              a.id,
                              makeAssetFolderMenuHandlers('audio', 'audio', a.id),
                              [
                                {
                                  id: 'remove',
                                  label: 'Remove audio',
                                  danger: true,
                                  onSelect: () =>
                                    dispatch({ type: 'AUDIO_ASSET_REMOVE', assetId: a.id }),
                                },
                              ],
                              assetMulti.batchRefsInCategory('audio'),
                            ),
                            setContextMenu,
                          )
                        }
                        icon={<Music size={11} className="flex-shrink-0 text-[var(--muted)]" />}
                        title={a.path}
                      />
                    ))}
                    {folder.fonts
                      .filter(
                        (f) => !assetHiddenByVirtualFolder(project, 'fonts', 'font', f.id),
                      )
                      .map((f) => (
                      <TreeLeaf
                        key={f.id}
                        label={f.name}
                        depth={2}
                        selected={assetMulti.isSelected('font', f.id)}
                        {...explorerAssetDragProps(
                          assetMulti.dragRefsFor('fonts', 'font', f.id),
                        )}
                        onClick={(e) =>
                          assetMulti.handleAssetClick(e, 'fonts', 'font', f.id, () =>
                            assets.setSelection({ type: 'font', id: f.id }),
                          )
                        }
                        onContextMenu={(ev) =>
                          openExplorerContextMenu(
                            ev,
                            buildAssetFolderMenuItems(
                              project,
                              'fonts',
                              'font',
                              f.id,
                              makeAssetFolderMenuHandlers('fonts', 'font', f.id),
                              [
                                {
                                  id: 'remove',
                                  label: 'Remove font',
                                  danger: true,
                                  onSelect: () =>
                                    dispatch({ type: 'FONT_ASSET_REMOVE', assetId: f.id }),
                                },
                              ],
                              assetMulti.batchRefsInCategory('fonts'),
                            ),
                            setContextMenu,
                          )
                        }
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
                        onContextMenu={(ev) =>
                          openExplorerContextMenu(
                            ev,
                            [
                              {
                                id: 'open',
                                label: 'Open in script editor',
                                onSelect: () => assets.openScript(s.path),
                              },
                            ],
                            setContextMenu,
                          )
                        }
                        icon={<FileText size={11} className="flex-shrink-0 text-[var(--muted)]" />}
                        title={s.path}
                      />
                    ))}
                    {folder.tilesets
                      .filter(
                        (t) =>
                          !assetHiddenByVirtualFolder(
                            project,
                            'tilesets',
                            'tileset',
                            t.assetId,
                          ),
                      )
                      .map((t) => (
                      <TreeLeaf
                        key={t.assetId}
                        label={t.name}
                        depth={2}
                        selected={assetMulti.isSelected('tileset', t.assetId)}
                        {...explorerAssetDragProps(
                          assetMulti.dragRefsFor('tilesets', 'tileset', t.assetId),
                        )}
                        onClick={(e) =>
                          assetMulti.handleAssetClick(
                            e,
                            'tilesets',
                            'tileset',
                            t.assetId,
                            () => assets.openTilesetEditor(t.assetId),
                          )
                        }
                        onContextMenu={(ev) =>
                          openExplorerContextMenu(
                            ev,
                            buildAssetFolderMenuItems(
                              project,
                              'tilesets',
                              'tileset',
                              t.assetId,
                              makeAssetFolderMenuHandlers('tilesets', 'tileset', t.assetId),
                              [
                                {
                                  id: 'edit',
                                  label: 'Open Tileset Editor',
                                  onSelect: () => assets.openTilesetEditor(t.assetId),
                                },
                                {
                                  id: 'remove',
                                  label: 'Remove tileset',
                                  danger: true,
                                  onSelect: () =>
                                    dispatch({
                                      type: 'TILESET_ASSET_REMOVE',
                                      assetId: t.assetId,
                                    }),
                                },
                              ],
                              assetMulti.batchRefsInCategory('tilesets'),
                            ),
                            setContextMenu,
                          )
                        }
                        icon={
                          <TilesetTreeThumbnail
                            tileset={project.tilesets?.[t.assetId]}
                            projectPath={projectPath}
                            onOpenEditor={() => assets.openTilesetEditor(t.assetId)}
                          />
                        }
                        title="Click to open Tileset Editor"
                      />
                    ))}
                  </TreeFolder>
                )
              })}
            </AssetTreeDnDRoot>
          </TreeSection>

          <TreeSection
            title="Dialogs"
            open={isOpen('dialogs')}
            onToggle={() => toggle('dialogs')}
          >
            {Object.keys(dialogs)
              .sort((a, b) => a.localeCompare(b))
              .map((dialogId) => (
                <TreeLeaf
                  key={dialogId}
                  label={dialogId}
                  depth={1}
                  onClick={() => openDialogEditorForId(dispatch, store.getState().dialogs, dialogId)}
                  icon={<MessageSquare size={11} className="flex-shrink-0 text-[var(--accent)]" />}
                  title={`dialogs/${dialogId}.json`}
                />
              ))}
            {Object.keys(dialogs).length === 0 ? (
              <p className="px-3 py-2 text-[10px] text-[var(--muted)]">No dialog scripts yet. Use View → Dialog library…</p>
            ) : null}
          </TreeSection>

          {assets.selection?.type === 'image' ? (
            <AssetDetailStrip selection={assets.selection} />
          ) : null}
          {assets.selection?.type === 'audio' || assets.selection?.type === 'font' ? (
            <AssetMediaDetailStrip selection={assets.selection} />
          ) : null}
        </div>
        ) : null}
      </div>

      <div className="px-2 py-1 border-t border-[var(--outline)] text-[9px] text-[var(--muted)] flex-shrink-0">
        {scene.sceneCount} scenes · {tree.entityGroups.length} types ·{' '}
        {tree.entityGroups.reduce((n, g) => n + g.instances.length, 0)} objects
      </div>
    </div>
  )
}
