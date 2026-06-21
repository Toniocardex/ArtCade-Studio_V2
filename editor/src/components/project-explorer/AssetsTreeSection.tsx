import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { ProjectDoc } from '../../types'
import type { useEditorDispatch } from '../../store/editor-store'
import type { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import type { ExplorerExpandKey } from '../../hooks/useExplorerExpanded'
import type { ImageImportTarget, useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import type { useAssetFolderActions } from '../../hooks/useAssetFolderActions'
import type { useAssetTreeMultiSelect } from '../../hooks/useAssetTreeMultiSelect'
import {
  explorerFolderIdToCategory,
  type VirtualAssetRefType,
} from '../../utils/asset-virtual-folders'
import {
  AssetTreeDnDRoot,
  libraryCategoryFolderId,
  type AssetDropZone,
} from './asset-tree-dnd'
import { VirtualFoldersBlock } from './VirtualFoldersBlock'
import { TreeSection } from './TreeSection'
import { TreeFolder } from './TreeNode'
import { AssetToolbar } from './AssetToolbar'
import {
  openExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'
import { useAssetFolderMenus } from './useAssetFolderMenus'
import { AssetImageTree } from './AssetImageTree'
import { resolveAssetLeaf } from './resolve-asset-leaf'
import { AssetFolderLeaves } from './AssetFolderLeaves'

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

  // OS file drop → import images into the folder under the pointer. Images-only:
  // dropping on a usage/image folder targets it; anywhere else falls back to sprites.
  const handleDropFiles = useCallback(
    (zone: AssetDropZone | null, files: readonly File[]) => {
      let target: ImageImportTarget = { usage: 'sprite' }
      if (zone?.kind === 'image-usage') {
        target = { usage: zone.usage }
      } else if (zone?.kind === 'virtual-folder') {
        const vf = project.assetVirtualFolders?.[zone.folderId]
        if (vf?.category === 'images') {
          target = { usage: vf.usage ?? 'sprite', folderId: vf.id }
        }
      }
      assets.importImageFiles(files, target)
    },
    [project, assets],
  )

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
        onCreateAnimatedSprite={assets.triggerCreateAnimatedSprite}
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
        onDropFiles={handleDropFiles}
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
                  resolveLeaf={(type, id) =>
                    resolveAssetLeaf(type, id, {
                      folder,
                      project,
                      projectPath,
                      libraryCategory,
                      assets,
                      assetMulti,
                      selectedEntityId,
                      dispatch,
                    })
                  }
                />
              ) : null}
              {folder.id === 'images' ? (
                <AssetImageTree
                  folder={folder}
                  project={project}
                  projectPath={projectPath}
                  hasSearch={tree.hasSearch}
                  assets={assets}
                  assetFolders={assetFolders}
                  assetMulti={assetMulti}
                  selectedEntityId={selectedEntityId}
                  isOpen={isOpen}
                  toggle={toggle}
                  setContextMenu={setContextMenu}
                  dispatch={dispatch}
                />
              ) : null}
              <AssetFolderLeaves
                folder={folder}
                project={project}
                projectPath={projectPath}
                assets={assets}
                assetMulti={assetMulti}
                dispatch={dispatch}
                setContextMenu={setContextMenu}
                makeAssetFolderMenuHandlers={makeAssetFolderMenuHandlers}
              />
            </TreeFolder>
          )
        })}
      </AssetTreeDnDRoot>
    </TreeSection>
  )
}
