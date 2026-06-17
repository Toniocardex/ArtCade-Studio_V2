import type { DragEvent } from 'react'
import {
  createAssetDragPayloadV1,
  writeAssetDragPayload,
  type AssetDragRef,
} from '../../utils/asset-explorer-dnd'

/** Drag props for an explorer asset tree row. */
export function explorerAssetDragProps(
  refs: readonly AssetDragRef[],
  sourceFolderId: string | null = null,
) {
  return {
    draggable: true as const,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      writeAssetDragPayload(e.dataTransfer, createAssetDragPayloadV1(refs, sourceFolderId))
    },
  }
}
