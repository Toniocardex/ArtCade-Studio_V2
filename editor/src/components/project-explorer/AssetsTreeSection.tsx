import type { Dispatch, SetStateAction } from 'react'
import { FileText, Music, Type } from 'lucide-react'
import type { ProjectDoc } from '../../types'
import type { useEditorDispatch } from '../../store/editor-store'
import type { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import type { ExplorerExpandKey } from '../../hooks/useExplorerExpanded'
import type { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import type { useAssetFolderActions } from '../../hooks/useAssetFolderActions'
import type { useAssetTreeMultiSelect } from '../../hooks/useAssetTreeMultiSelect'
import {
  explorerFolderIdToCategory,
  virtualFolderContainingAsset,
  type VirtualAssetRefType,
} from '../../utils/asset-virtual-folders'
import { buildAssetFolderMenuItems } from './asset-folder-context-menus'
import { explorerAssetDragProps } from './explorer-asset-drag'
import {
  AssetTreeDnDRoot,
  imageUsageFolderId,
  libraryCategoryFolderId,
  virtualAssetFolderId,
} from './asset-tree-dnd'
import {
  VirtualFoldersBlock,
  assetHiddenByVirtualFolder,
} from './VirtualFoldersBlock'
import { TreeSection } from './TreeSection'
import { TreeFolder, TreeLeaf } from './TreeNode'
import { AssetToolbar } from './AssetToolbar'
import { ImageTreeThumbnail } from '../asset-explorer/ImageTreeThumbnail'
import { TilesetTreeThumbnail } from '../asset-explorer/TilesetTreeThumbnail'
import {
  openExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'
import { useAssetFolderMenus } from './useAssetFolderMenus'

export type AssetsTreeSectionProps = Readonly<{
  project: ProjectDoc
  projectPath: string | null
  tree: ReturnType<typeof buildProjectExplorerData>
  assets: ReturnType<typeof useAssetExplorerActions>
  assetFolders: ReturnType<typeof useAssetFolderActions>
  assetMulti: ReturnType<typeof useAssetTreeMultiSelect>
  selectedEntityId: number | null
  isOpen: (key: ExplorerExpandKey, defaultOpen?: boolean) => boolean
  toggle: (key: ExplorerExpandKey, defaultOpen?: boolean) => void
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
  dispatch: ReturnType<typeof useEditorDispatch>
  allAssetFoldersExpanded: boolean
  onToggleAssetFoldersExpand: () => void
}>

/**
 * The "Assets" tree section: toolbar + flash banner + the drag-and-drop asset
 * tree (images with usage groups and virtual folders, audio, fonts, scripts,
 * tilesets). Extracted from ProjectExplorerPanel.
 */
export function AssetsTreeSection({
  project,
  projectPath,
  tree,
  assets,
  assetFolders,
  assetMulti,
  selectedEntityId,
  isOpen,
  toggle,
  setContextMenu,
  dispatch,
  allAssetFoldersExpanded,
  onToggleAssetFoldersExpand,
}: AssetsTreeSectionProps) {
  const {
    makeAssetFolderMenuHandlers,
    buildLibraryFolderMenuItems,
    buildVirtualFolderImportItems,
  } = useAssetFolderMenus(assets, assetFolders)

  return (
    <TreeSection
      title="Assets"
      open={isOpen('assets')}
      onToggle={() => toggle('assets')}
      hidden={!tree.assetsVisible}
    >
      <AssetToolbar
        disabled={!project}
        canRemove={assets.canRemove}
        onImportImage={assets.triggerImportImage}
        onImportTileset={assets.triggerImportTileset}
        onImportAudio={assets.triggerImportAudio}
        onImportFont={assets.triggerImportFont}
        allAssetFoldersExpanded={allAssetFoldersExpanded}
        onToggleAssetFoldersExpand={onToggleAssetFoldersExpand}
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
        onMoveRefsToImageUsage={assetFolders.moveRefsToImageUsage}
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
          const libraryFolderMenuItems = libraryCategory
            ? buildLibraryFolderMenuItems(libraryCategory)
            : []
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
              onContextMenu={
                libraryFolderMenuItems.length > 0
                  ? (ev) =>
                      openExplorerContextMenu(
                        ev,
                        libraryFolderMenuItems,
                        setContextMenu,
                      )
                  : undefined
              }
            >
              {folder.count === 0 ? (
                <div className="flex flex-col items-start py-1.5 pl-4">
                  <p className="text-[10px] text-[var(--muted)]">No assets yet.</p>
                </div>
              ) : null}
              {libraryCategory && folderHandlers && libraryCategory !== 'images' ? (
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
                  folderExtraMenuItems={(vf) =>
                    buildVirtualFolderImportItems(libraryCategory, vf.id)
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
              {folder.id === 'images'
                ? folder.imageUsageGroups.map((group) => {
                    const usageKey = `asset:images:${group.usage}` as const
                    const usageOpen = isOpen(usageKey) || tree.hasSearch
                    const usageFolders = assetFolders.imageFoldersForUsage(group.usage)
                    const imageFolderFor = (imageId: string) =>
                      virtualFolderContainingAsset(project, 'images', 'image', imageId)
                    const renderImageLeaf = (img: (typeof group.images)[number], depth: number) => {
                      const asset = project.assets?.[img.id]
                      const isSprite = asset?.usage === 'sprite'
                      return (
                        <TreeLeaf
                          key={img.id}
                          label={img.name}
                          depth={depth}
                          selected={assetMulti.isSelected('image', img.id)}
                          spritesheetStudioTrigger={Boolean(asset && isSprite)}
                          {...explorerAssetDragProps(
                            assetMulti.dragRefsFor('images', 'image', img.id),
                            imageFolderFor(img.id)?.id ?? null,
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
                            asset && isSprite ? () => assets.openImageStudio(img.id) : undefined
                          }
                          onContextMenu={(ev) => {
                            if (!asset) return
                            const imageActions = [
                              ...(isSprite
                                ? [
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
                                  ]
                                : []),
                              {
                                id: 'remove',
                                label: 'Remove image',
                                danger: true,
                                onSelect: () =>
                                  dispatch({ type: 'ASSET_REMOVE', assetId: img.id }),
                              },
                            ]
                            openExplorerContextMenu(ev, imageActions, setContextMenu)
                          }}
                          title={isSprite ? 'Double-click to open Sprite Studio' : img.path}
                          icon={
                            <ImageTreeThumbnail
                              asset={asset}
                              projectPath={projectPath}
                              onOpenStudio={() => assets.openImageStudio(img.id)}
                            />
                          }
                        />
                      )
                    }
                    return (
                      <TreeFolder
                        key={group.usage}
                        label={group.label}
                        count={group.images.length}
                        depth={2}
                        assetFolderId={imageUsageFolderId(group.usage)}
                        open={usageOpen}
                        onToggle={() => toggle(usageKey)}
                        onContextMenu={(ev) =>
                          openExplorerContextMenu(
                            ev,
                            [
                              {
                                id: `import-${group.usage}`,
                                label: 'Import image here',
                                onSelect: () => assets.triggerImportImage({ usage: group.usage }),
                              },
                              {
                                id: `new-folder-${group.usage}`,
                                label: 'New folder...',
                                onSelect: () => assetFolders.createVirtualFolder('images', group.usage),
                              },
                            ],
                            setContextMenu,
                          )
                        }
                      >
                        {usageFolders.map((vf) => {
                          const folderImages = vf.assetRefs
                            .filter((ref) => ref.type === 'image')
                            .map((ref) => group.images.find((img) => img.id === ref.id))
                            .filter((img): img is (typeof group.images)[number] => Boolean(img))
                          return (
                            <TreeFolder
                              key={vf.id}
                              label={vf.name}
                              count={folderImages.length}
                              depth={3}
                              assetFolderId={virtualAssetFolderId(vf.id)}
                              open={isOpen(`asset:vf:${vf.id}`)}
                              onToggle={() => toggle(`asset:vf:${vf.id}`)}
                              onDoubleClick={() => assetFolders.renameVirtualFolder(vf.id)}
                              onContextMenu={(ev) =>
                                openExplorerContextMenu(
                                  ev,
                                  [
                                    {
                                      id: `import-${vf.id}`,
                                      label: 'Import image here',
                                      onSelect: () =>
                                        assets.triggerImportImage({
                                          usage: group.usage,
                                          folderId: vf.id,
                                        }),
                                    },
                                    {
                                      id: `rename-${vf.id}`,
                                      label: 'Rename folder...',
                                      onSelect: () => assetFolders.renameVirtualFolder(vf.id),
                                    },
                                    {
                                      id: `delete-${vf.id}`,
                                      label: `Delete folder "${vf.name}"`,
                                      danger: true,
                                      onSelect: () => assetFolders.deleteVirtualFolder(vf.id, vf.name),
                                    },
                                  ],
                                  setContextMenu,
                                )
                              }
                            >
                              {folderImages.map((img) => renderImageLeaf(img, 4))}
                            </TreeFolder>
                          )
                        })}
                        {group.images
                          .filter((img) => !imageFolderFor(img.id))
                          .map((img) => renderImageLeaf(img, 3))}
                      </TreeFolder>
                    )
                  })
                : null}
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
  )
}
