import type { AssetFolderCategory, ProjectDoc } from '../../types'
import type { ExplorerContextMenuItem } from './explorer-context-menu'
import type { AssetDragRef } from '../../utils/asset-explorer-dnd'
import {
  isAssetInVirtualFolder,
  virtualFolderContainingAsset,
  virtualFoldersForCategory,
  type VirtualAssetRefType,
} from '../../utils/asset-virtual-folders'

export function buildVirtualFolderMenuItems(
  folderId: string,
  folderName: string,
  handlers: Readonly<{
    onRename: () => void
    onDelete: () => void
  }>,
): ExplorerContextMenuItem[] {
  return [
    {
      id: `rename-folder-${folderId}`,
      label: 'Rename folder…',
      onSelect: handlers.onRename,
    },
    {
      id: `delete-folder-${folderId}`,
      label: `Delete folder "${folderName}"`,
      danger: true,
      onSelect: handlers.onDelete,
    },
  ]
}

export type AssetFolderMenuHandlers = Readonly<{
  onMoveToFolder: (folderId: string) => void
  onMoveRefsToFolder: (folderId: string, refs: readonly AssetDragRef[]) => void
  onUnassign: () => void
  onUnassignRefs: (refs: readonly AssetDragRef[]) => void
  onCreateFolder: () => void
}>

export function buildAssetFolderMenuItems(
  project: ProjectDoc,
  category: AssetFolderCategory,
  assetType: VirtualAssetRefType,
  assetId: string,
  handlers: AssetFolderMenuHandlers,
  extraItems: readonly ExplorerContextMenuItem[] = [],
  batchRefs: readonly AssetDragRef[] = [],
): ExplorerContextMenuItem[] {
  const items: ExplorerContextMenuItem[] = [...extraItems]
  const folders = virtualFoldersForCategory(project, category)
  const inVirtual = isAssetInVirtualFolder(project, category, assetType, assetId)
  const batch = batchRefs.length > 1 ? batchRefs : []
  const batchCount = batch.length

  if (folders.length > 0) {
    for (const f of folders) {
      if (batchCount > 0) {
        const allInFolder = batch.every(
          (ref) => virtualFolderContainingAsset(project, category, ref.type, ref.id)?.id === f.id,
        )
        items.push({
          id: `move-batch-${f.id}`,
          label: allInFolder
            ? `${batchCount} items in folder: ${f.name}`
            : `Move ${batchCount} items to: ${f.name}`,
          disabled: allInFolder,
          onSelect: () => handlers.onMoveRefsToFolder(f.id, batch),
        })
        continue
      }
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

  if (batchCount > 0) {
    const anyInVirtual = batch.some((ref) =>
      isAssetInVirtualFolder(project, category, ref.type, ref.id),
    )
    if (anyInVirtual) {
      items.push({
        id: 'unassign-batch',
        label: `Remove ${batchCount} items from folder`,
        onSelect: () => handlers.onUnassignRefs(batch),
      })
    }
  } else if (inVirtual) {
    items.push({
      id: 'unassign-folder',
      label: 'Remove from folder',
      onSelect: handlers.onUnassign,
    })
  }

  return items
}
