import type { VirtualAssetRefType } from './asset-virtual-folders'

/** Custom MIME for ArtCade asset explorer drag-and-drop (WebView2 + browser). */
export const ARTCADE_ASSET_DND_MIME = 'application/x-artcade-asset-refs'

/** @deprecated Use {@link ARTCADE_ASSET_DND_MIME}. */
export const ASSET_REF_DRAG_MIME = ARTCADE_ASSET_DND_MIME

export type AssetDragRef = Readonly<{
  type: VirtualAssetRefType
  id: string
}>

export type AssetMoveSource = 'drag-and-drop' | 'context-menu'

export type AssetDragPayloadV1 = Readonly<{
  version: 1
  kind: 'asset-refs'
  operation: 'move'
  refs: readonly AssetDragRef[]
  sourceFolderId: string | null
}>

function isAssetDragRef(value: unknown): value is AssetDragRef {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  const type = o.type
  return (
    (type === 'image' || type === 'audio' || type === 'font' || type === 'tileset')
    && typeof o.id === 'string'
    && o.id.length > 0
  )
}

export function isAssetDragPayloadV1(value: unknown): value is AssetDragPayloadV1 {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<AssetDragPayloadV1>
  return (
    payload.version === 1
    && payload.kind === 'asset-refs'
    && payload.operation === 'move'
    && Array.isArray(payload.refs)
    && payload.refs.length > 0
    && payload.refs.every(isAssetDragRef)
    && (payload.sourceFolderId === null || typeof payload.sourceFolderId === 'string')
  )
}

/** Builds a versioned drag payload for one or more asset refs. */
export function createAssetDragPayloadV1(
  refs: readonly AssetDragRef[],
  sourceFolderId: string | null = null,
): AssetDragPayloadV1 {
  return {
    version: 1,
    kind: 'asset-refs',
    operation: 'move',
    refs,
    sourceFolderId,
  }
}

/**
 * Writes a versioned asset drag payload to a DataTransfer.
 * @param dataTransfer native drag payload (must not be null)
 * @param payload versioned drag payload (empty refs is a no-op)
 */
export function writeAssetDragPayload(
  dataTransfer: DataTransfer,
  payload: AssetDragPayloadV1,
): void {
  if (payload.refs.length === 0) return
  const serialized = JSON.stringify(payload)
  dataTransfer.setData(ARTCADE_ASSET_DND_MIME, serialized)
  dataTransfer.setData('text/plain', serialized)
  dataTransfer.effectAllowed = 'move'
}

/**
 * Reads a versioned drag payload from a drop event.
 * Accepts legacy bare ref arrays for in-session compatibility.
 */
export function readAssetDragPayload(dataTransfer: DataTransfer): AssetDragPayloadV1 | null {
  const raw =
    dataTransfer.getData(ARTCADE_ASSET_DND_MIME) || dataTransfer.getData('text/plain')
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isAssetDragPayloadV1(parsed)) return parsed
    if (Array.isArray(parsed)) {
      const refs = parsed.filter(isAssetDragRef)
      if (refs.length === 0) return null
      return createAssetDragPayloadV1(refs, null)
    }
    return null
  } catch {
    return null
  }
}

/** Returns asset refs from a DataTransfer, or an empty array when invalid. */
export function readAssetDragRefs(dataTransfer: DataTransfer): readonly AssetDragRef[] {
  return readAssetDragPayload(dataTransfer)?.refs ?? []
}
