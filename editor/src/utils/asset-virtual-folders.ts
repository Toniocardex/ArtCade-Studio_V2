// ---------------------------------------------------------------------------
// asset-virtual-folders — helpers for Project Explorer virtual folders
// ---------------------------------------------------------------------------

import type { AssetFolderCategory, AssetVirtualFolderDef, ProjectDoc } from '../types'
import type { AssetExplorerSelection } from '../hooks/useAssetExplorerActions'

export type VirtualAssetRefType = 'image' | 'audio' | 'font' | 'tileset'

/** Library categories that support user-created virtual folders (not scripts). */
export const ASSET_VIRTUAL_FOLDER_CATEGORIES = [
  'images',
  'audio',
  'fonts',
  'tilesets',
] as const

export type AssetVirtualFolderCategory = (typeof ASSET_VIRTUAL_FOLDER_CATEGORIES)[number]

export const VIRTUAL_ASSET_TYPE_TO_CATEGORY: Record<
  VirtualAssetRefType,
  AssetVirtualFolderCategory
> = {
  image: 'images',
  audio: 'audio',
  font: 'fonts',
  tileset: 'tilesets',
}

/** Stable multi-select key for a virtual-folder asset ref. */
export function virtualAssetRefKey(type: VirtualAssetRefType, id: string): string {
  return `${type}:${id}`
}

/**
 * Parses a multi-select key produced by {@link virtualAssetRefKey}.
 * @returns ref or null when the key is malformed
 */
export function parseVirtualAssetRefKey(
  key: string,
): Readonly<{ type: VirtualAssetRefType; id: string }> | null {
  const sep = key.indexOf(':')
  if (sep <= 0) return null
  const type = key.slice(0, sep) as VirtualAssetRefType
  const id = key.slice(sep + 1)
  if (!id) return null
  if (type !== 'image' && type !== 'audio' && type !== 'font' && type !== 'tileset') return null
  return { type, id }
}

export const ASSET_VIRTUAL_FOLDER_CATEGORY_LABELS: Record<AssetVirtualFolderCategory, string> = {
  images: 'Images',
  audio: 'Audio',
  fonts: 'Fonts',
  tilesets: 'Tilesets',
}

function normalizeVirtualFolderName(name: string): string {
  return name.trim() || 'New Folder'
}

function virtualFolderNamesInCategory(
  project: ProjectDoc,
  category: AssetFolderCategory,
  excludingFolderId?: string,
): Set<string> {
  const taken = new Set<string>()
  for (const folder of Object.values(project.assetVirtualFolders ?? {})) {
    if (folder.category !== category) continue
    if (folder.id === excludingFolderId) continue
    taken.add(folder.name.toLowerCase())
  }
  return taken
}

/**
 * Whether a display name is already used by another virtual folder in the category.
 * Comparison is case-insensitive.
 */
export function isVirtualFolderNameTaken(
  project: ProjectDoc,
  category: AssetFolderCategory,
  name: string,
  excludingFolderId?: string,
): boolean {
  const normalized = normalizeVirtualFolderName(name)
  return virtualFolderNamesInCategory(project, category, excludingFolderId).has(
    normalized.toLowerCase(),
  )
}

/**
 * Returns a unique folder display name within a category (auto-suffix " 2", " 3", …).
 */
export function uniqueVirtualFolderName(
  project: ProjectDoc,
  category: AssetFolderCategory,
  baseName: string,
  excludingFolderId?: string,
): string {
  const base = normalizeVirtualFolderName(baseName)
  const taken = virtualFolderNamesInCategory(project, category, excludingFolderId)
  if (!taken.has(base.toLowerCase())) return base
  let i = 2
  while (taken.has(`${base} ${i}`.toLowerCase())) i += 1
  return `${base} ${i}`
}

export function explorerFolderIdToCategory(
  folderId: string,
): AssetVirtualFolderCategory | null {
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
