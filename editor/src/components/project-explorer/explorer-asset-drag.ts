import type { DragEvent } from 'react'
import { readAssetDragPayload, writeAssetDragPayload, type AssetDragRef } from '../../utils/asset-explorer-dnd'
import {
  VIRTUAL_ASSET_TYPE_TO_CATEGORY,
  type AssetVirtualFolderCategory,
} from '../../utils/asset-virtual-folders'

/** Drag props for an explorer asset tree row. */
export function explorerAssetDragProps(refs: readonly AssetDragRef[]) {
  return {
    draggable: true as const,
    onDragStart: (e: DragEvent) => {
      e.stopPropagation()
      writeAssetDragPayload(e.dataTransfer, refs)
    },
  }
}

/**
 * Drop handlers for a virtual folder row. Filters refs to the folder category.
 */
export function explorerVirtualFolderDropHandlers(
  folderId: string,
  category: AssetVirtualFolderCategory,
  onMoveRefs: (folderId: string, refs: readonly AssetDragRef[]) => void,
  setDropHighlight: (active: boolean) => void,
) {
  return {
    onFolderDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    onFolderDragEnter: (e: DragEvent) => {
      e.preventDefault()
      setDropHighlight(true)
    },
    onFolderDragLeave: (e: DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setDropHighlight(false)
    },
    onFolderDrop: (e: DragEvent) => {
      e.preventDefault()
      setDropHighlight(false)
      const refs = readAssetDragPayload(e.dataTransfer).filter(
        (ref) => VIRTUAL_ASSET_TYPE_TO_CATEGORY[ref.type] === category,
      )
      if (refs.length > 0) onMoveRefs(folderId, refs)
    },
  }
}

/**
 * Drop on a library category row removes refs from virtual folders (unassign).
 */
export function explorerLibraryCategoryDropHandlers(
  category: AssetVirtualFolderCategory,
  onUnassignRefs: (refs: readonly AssetDragRef[]) => void,
  setDropHighlight: (active: boolean) => void,
) {
  return {
    onFolderDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    onFolderDragEnter: (e: DragEvent) => {
      e.preventDefault()
      setDropHighlight(true)
    },
    onFolderDragLeave: (e: DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setDropHighlight(false)
    },
    onFolderDrop: (e: DragEvent) => {
      e.preventDefault()
      setDropHighlight(false)
      const refs = readAssetDragPayload(e.dataTransfer).filter(
        (ref) => VIRTUAL_ASSET_TYPE_TO_CATEGORY[ref.type] === category,
      )
      if (refs.length > 0) onUnassignRefs(refs)
    },
  }
}
