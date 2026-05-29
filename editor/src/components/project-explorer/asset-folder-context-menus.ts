import type { AssetFolderCategory, ProjectDoc } from '../../types'
import type { ExplorerContextMenuItem } from './explorer-context-menu'
import {
  isAssetInVirtualFolder,
  virtualFolderContainingAsset,
  virtualFoldersForCategory,
  type VirtualAssetRefType,
} from '../../utils/asset-virtual-folders'

export function buildVirtualFolderMenuItems(
  folderId: string,
  folderName: string,
  onDelete: () => void,
): ExplorerContextMenuItem[] {
  return [
    {
      id: `delete-folder-${folderId}`,
      label: `Delete folder "${folderName}"`,
      danger: true,
      onSelect: onDelete,
    },
  ]
}

export function buildAssetFolderMenuItems(
  project: ProjectDoc,
  category: AssetFolderCategory,
  assetType: VirtualAssetRefType,
  assetId: string,
  handlers: Readonly<{
    onMoveToFolder: (folderId: string) => void
    onUnassign: () => void
    onCreateFolder: () => void
  }>,
  extraItems: readonly ExplorerContextMenuItem[] = [],
): ExplorerContextMenuItem[] {
  const items: ExplorerContextMenuItem[] = [...extraItems]
  const folders = virtualFoldersForCategory(project, category)
  const inVirtual = isAssetInVirtualFolder(project, category, assetType, assetId)

  if (folders.length > 0) {
    for (const f of folders) {
      const already =
        virtualFolderContainingAsset(project, category, assetType, assetId)?.id === f.id
      items.push({
        id: `move-${f.id}`,
        label: already ? `In folder: ${f.name}` : `Move to: ${f.name}`,
        disabled: already,
        onSelect: () => handlers.onMoveToFolder(f.id),
      })
    }
  } else {
    items.push({
      id: 'create-folder-move',
      label: 'Create folder…',
      onSelect: handlers.onCreateFolder,
    })
  }

  if (inVirtual) {
    items.push({
      id: 'unassign-folder',
      label: 'Remove from folder',
      onSelect: handlers.onUnassign,
    })
  }

  return items
}
