// ---------------------------------------------------------------------------
// asset-virtual-folders — helpers for Project Explorer virtual folders
// ---------------------------------------------------------------------------

import type { AssetFolderCategory, AssetVirtualFolderDef, ProjectDoc } from '../types'
import type { AssetExplorerSelection } from '../hooks/useAssetExplorerActions'

export type VirtualAssetRefType = 'image' | 'audio' | 'font' | 'tileset'

export function explorerFolderIdToCategory(
  folderId: string,
): AssetFolderCategory | null {
  if (
    folderId === 'images' ||
    folderId === 'audio' ||
    folderId === 'fonts' ||
    folderId === 'tilesets'
  ) {
    return folderId
  }
  return null
}

export function selectionToVirtualRef(
  selection: AssetExplorerSelection,
): { type: VirtualAssetRefType; id: string } | null {
  if (selection.type === 'image') return { type: 'image', id: selection.id }
  if (selection.type === 'audio') return { type: 'audio', id: selection.id }
  if (selection.type === 'font') return { type: 'font', id: selection.id }
  if (selection.type === 'tileset') return { type: 'tileset', id: selection.id }
  return null
}

export function virtualFoldersForCategory(
  project: ProjectDoc,
  category: AssetFolderCategory,
): AssetVirtualFolderDef[] {
  return Object.values(project.assetVirtualFolders ?? {}).filter((f) => f.category === category)
}

export function isAssetInVirtualFolder(
  project: ProjectDoc,
  category: AssetFolderCategory,
  type: VirtualAssetRefType,
  assetId: string,
): boolean {
  return virtualFoldersForCategory(project, category).some((f) =>
    f.assetRefs.some((r) => r.type === type && r.id === assetId),
  )
}

export function virtualFolderContainingAsset(
  project: ProjectDoc,
  category: AssetFolderCategory,
  type: VirtualAssetRefType,
  assetId: string,
): AssetVirtualFolderDef | undefined {
  return virtualFoldersForCategory(project, category).find((f) =>
    f.assetRefs.some((r) => r.type === type && r.id === assetId),
  )
}
