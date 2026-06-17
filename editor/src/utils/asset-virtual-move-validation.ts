import type { ProjectDoc } from '../types'
import {
  VIRTUAL_ASSET_TYPE_TO_CATEGORY,
  virtualFolderContainingAsset,
  type AssetVirtualFolderCategory,
} from './asset-virtual-folders'
import type { AssetDragRef } from './asset-explorer-dnd'

export type VirtualAssetMoveRejectReason =
  | 'TARGET_NOT_FOUND'
  | 'EMPTY_REFS'
  | 'CATEGORY_MISMATCH'
  | 'SAME_FOLDER'
  | 'SOURCE_NOT_FOUND'

export type VirtualAssetMoveValidation =
  | { ok: true }
  | { ok: false; reason: VirtualAssetMoveRejectReason }

export type VirtualAssetUnassignRejectReason =
  | 'EMPTY_REFS'
  | 'CATEGORY_MISMATCH'
  | 'NOT_IN_FOLDER'

export type VirtualAssetUnassignValidation =
  | { ok: true }
  | { ok: false; reason: VirtualAssetUnassignRejectReason }

function assetExistsInProject(project: ProjectDoc, ref: AssetDragRef): boolean {
  switch (ref.type) {
    case 'image':
      return Boolean(project.assets?.[ref.id])
    case 'audio':
      return Boolean(project.audioAssets?.[ref.id])
    case 'font':
      return Boolean(project.fontAssets?.[ref.id])
    case 'tileset':
      return Boolean(project.tilesets?.[ref.id])
    default:
      return false
  }
}

/**
 * Validates moving refs into a virtual folder (atomic — all refs or none).
 */
export function validateVirtualAssetMoveToFolder(
  project: ProjectDoc,
  folderId: string,
  refs: readonly AssetDragRef[],
): VirtualAssetMoveValidation {
  if (refs.length === 0) return { ok: false, reason: 'EMPTY_REFS' }

  const folder = project.assetVirtualFolders?.[folderId]
  if (!folder) return { ok: false, reason: 'TARGET_NOT_FOUND' }

  for (const ref of refs) {
    if (!assetExistsInProject(project, ref)) {
      return { ok: false, reason: 'SOURCE_NOT_FOUND' }
    }
    if (VIRTUAL_ASSET_TYPE_TO_CATEGORY[ref.type] !== folder.category) {
      return { ok: false, reason: 'CATEGORY_MISMATCH' }
    }
    const current = virtualFolderContainingAsset(project, folder.category, ref.type, ref.id)
    if (current?.id === folderId) {
      return { ok: false, reason: 'SAME_FOLDER' }
    }
  }

  return { ok: true }
}

/**
 * Validates unassigning refs from virtual folders onto a library category root.
 */
export function validateVirtualAssetUnassign(
  project: ProjectDoc,
  category: AssetVirtualFolderCategory,
  refs: readonly AssetDragRef[],
): VirtualAssetUnassignValidation {
  if (refs.length === 0) return { ok: false, reason: 'EMPTY_REFS' }

  for (const ref of refs) {
    if (VIRTUAL_ASSET_TYPE_TO_CATEGORY[ref.type] !== category) {
      return { ok: false, reason: 'CATEGORY_MISMATCH' }
    }
    if (!virtualFolderContainingAsset(project, category, ref.type, ref.id)) {
      return { ok: false, reason: 'NOT_IN_FOLDER' }
    }
  }

  return { ok: true }
}
