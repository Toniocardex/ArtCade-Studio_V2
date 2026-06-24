import type { Dispatch, SetStateAction } from 'react'
import { Film } from 'lucide-react'
import type { ProjectDoc } from '../../types'
import type { useEditorDispatch } from '../../store/editor-store'
import type { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import type { ExplorerExpandKey } from '../../hooks/useExplorerExpanded'
import type { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import type { useAssetFolderActions } from '../../hooks/useAssetFolderActions'
import type { useAssetTreeMultiSelect } from '../../hooks/useAssetTreeMultiSelect'
import { virtualFolderContainingAsset } from '../../utils/asset-virtual-folders'
import { explorerAssetDragProps } from './explorer-asset-drag'
import { imageUsageFolderId, virtualAssetFolderId } from './asset-tree-dnd'
import { TreeFolder, TreeLeaf } from './TreeNode'
import { ImageTreeThumbnail } from '../asset-explorer/ImageTreeThumbnail'
import {
  openExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'

type AssetFolder = ReturnType<typeof buildProjectExplorerData>['assetFolders'][number]

export type AssetImageTreeProps = Readonly<{
  folder: AssetFolder
  project: ProjectDoc
  projectPath: string | null
  hasSearch: boolean
  assets: ReturnType<typeof useAssetExplorerActions>
  assetFolders: ReturnType<typeof useAssetFolderActions>
  assetMulti: ReturnType<typeof useAssetTreeMultiSelect>
  selectedEntityId: number | null
  isOpen: (key: ExplorerExpandKey, defaultOpen?: boolean) => boolean
  toggle: (key: ExplorerExpandKey, defaultOpen?: boolean) => void
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
  dispatch: ReturnType<typeof useEditorDispatch>
}>

/**
 * The "images" folder body: one collapsible folder per usage (sprite, ui, …),
 * each with its virtual folders and image leaves, plus the empty-state import /
 * animated-sprite actions. Extracted from AssetsTreeSection.
 */
export function AssetImageTree({
  folder,
  project,
  projectPath,
  hasSearch,
  assets,
  assetFolders,
  assetMulti,
  selectedEntityId,
  isOpen,
  toggle,
  setContextMenu,
}: AssetImageTreeProps) {
  return (
    <>
      {folder.imageUsageGroups.map((group) => {
        const usageKey = `asset:images:${group.usage}` as const
        const usageOpen = isOpen(usageKey) || hasSearch
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
              actions={
                asset && isSprite ? (
                  <button
                    type="button"
                    title="Open in Sprite Studio"
                    aria-label="Open in Sprite Studio"
                    onClick={(e) => {
                      e.stopPropagation()
                      assets.openImageStudio(img.id)
                    }}
                    className="flex items-center justify-center w-5 h-5 rounded text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] group-hover:opacity-100 focus:opacity-100"
                  >
                    <Film size={12} />
                  </button>
                ) : undefined
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
                    onSelect: () => void assets.removeAsset({ type: 'image', id: img.id }),
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
                  ...(group.usage === 'sprite'
                    ? [
                        {
                          id: 'create-animated-sprite',
                          label: 'Create animated sprite',
                          onSelect: () => assets.triggerCreateAnimatedSprite(),
                        },
                      ]
                    : []),
                  {
                    id: `import-${group.usage}`,
                    label:
                      group.usage === 'sprite'
                        ? 'Import still sprite'
                        : 'Import image here',
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
      })}
    </>
  )
}
