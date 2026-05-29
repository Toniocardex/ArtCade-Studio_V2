import type { ReactNode } from 'react'
import type { AssetFolderCategory, AssetVirtualFolderDef, ProjectDoc } from '../../types'
import { TreeFolder, TreeLeaf } from './TreeNode'
import {
  buildVirtualFolderMenuItems,
  buildAssetFolderMenuItems,
} from './asset-folder-context-menus'
import {
  openExplorerContextMenu,
  type ExplorerContextMenuItem,
  type ExplorerContextMenuState,
} from './explorer-context-menu'
import type { VirtualAssetRefType } from '../../utils/asset-virtual-folders'
import type { ExplorerExpandKey } from '../../hooks/useExplorerExpanded'

export type VirtualFolderLeafRow = Readonly<{
  assetType: VirtualAssetRefType
  assetId: string
  label: string
  selected: boolean
  onClick: () => void
  onDoubleClick?: () => void
  icon: ReactNode
  title?: string
  extraMenuItems?: readonly ExplorerContextMenuItem[]
  spritesheetStudioTrigger?: boolean
}>

type VirtualFoldersBlockProps = Readonly<{
  project: ProjectDoc
  category: AssetFolderCategory
  folders: readonly AssetVirtualFolderDef[]
  depth: number
  isOpen: (key: ExplorerExpandKey) => boolean
  toggle: (key: ExplorerExpandKey) => void
  resolveLeaf: (type: VirtualAssetRefType, id: string) => VirtualFolderLeafRow | null
  setContextMenu: (state: ExplorerContextMenuState | null) => void
  onMoveToFolder: (folderId: string, assetType: VirtualAssetRefType, assetId: string) => void
  onUnassign: (assetType: VirtualAssetRefType, assetId: string) => void
  onCreateFolder: () => void
  onDeleteFolder: (folderId: string, folderName: string) => void
}>

export function VirtualFoldersBlock({
  project,
  category,
  folders,
  depth,
  isOpen,
  toggle,
  resolveLeaf,
  setContextMenu,
  onMoveToFolder,
  onUnassign,
  onCreateFolder,
  onDeleteFolder,
}: VirtualFoldersBlockProps) {
  if (folders.length === 0) return null

  return (
    <>
      {folders.map((vf) => (
        <TreeFolder
          key={vf.id}
          label={vf.name}
          count={vf.assetRefs.length}
          depth={depth}
          open={isOpen(`asset:vf:${vf.id}`)}
          onToggle={() => toggle(`asset:vf:${vf.id}`)}
          onContextMenu={(ev) =>
            openExplorerContextMenu(
              ev,
              buildVirtualFolderMenuItems(vf.id, vf.name, () =>
                onDeleteFolder(vf.id, vf.name),
              ),
              setContextMenu,
            )
          }
        >
          {vf.assetRefs.map((ref) => {
            if (ref.type !== 'image' && ref.type !== 'audio' && ref.type !== 'font' && ref.type !== 'tileset') {
              return null
            }
            const row = resolveLeaf(ref.type, ref.id)
            if (!row) return null
            return (
              <TreeLeaf
                key={`${vf.id}:${ref.type}:${ref.id}`}
                label={row.label}
                depth={depth + 1}
                selected={row.selected}
                onClick={row.onClick}
                onDoubleClick={row.onDoubleClick}
                onContextMenu={(ev) =>
                  openExplorerContextMenu(
                    ev,
                    buildAssetFolderMenuItems(
                      project,
                      category,
                      ref.type,
                      ref.id,
                      {
                        onMoveToFolder: (folderId) =>
                          onMoveToFolder(folderId, ref.type, ref.id),
                        onUnassign: () => onUnassign(ref.type, ref.id),
                        onCreateFolder,
                      },
                      row.extraMenuItems ?? [],
                    ),
                    setContextMenu,
                  )
                }
                title={row.title}
                icon={row.icon}
                spritesheetStudioTrigger={row.spritesheetStudioTrigger}
              />
            )
          })}
        </TreeFolder>
      ))}
    </>
  )
}

export function assetHiddenByVirtualFolder(
  project: ProjectDoc,
  category: AssetFolderCategory,
  assetType: VirtualAssetRefType,
  assetId: string,
): boolean {
  return Object.values(project.assetVirtualFolders ?? {}).some(
    (vf) =>
      vf.category === category &&
      vf.assetRefs.some((r) => r.type === assetType && r.id === assetId),
  )
}
