import type { VirtualAssetRefType } from './asset-virtual-folders'

export const ASSET_REF_DRAG_MIME = 'application/x-artcade-asset-refs'

export type AssetDragRef = Readonly<{
  type: VirtualAssetRefType
  id: string
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

/**
 * Writes draggable asset refs to a DataTransfer (HTML5 explorer drag).
 * @param dataTransfer native drag payload (must not be null)
 * @param refs asset refs to move (empty array is a no-op)
 */
export function writeAssetDragPayload(
  dataTransfer: DataTransfer,
  refs: readonly AssetDragRef[],
): void {
  if (refs.length === 0) return
  const json = JSON.stringify(refs)
  dataTransfer.setData(ASSET_REF_DRAG_MIME, json)
  // WebView2/Chromium may only expose text/plain on drop; keep both in sync.
  dataTransfer.setData('text/plain', json)
  dataTransfer.effectAllowed = 'move'
}

/**
 * Reads asset refs from a drop event. Returns an empty array when missing or invalid.
 */
export function readAssetDragPayload(dataTransfer: DataTransfer): AssetDragRef[] {
  const raw = dataTransfer.getData(ASSET_REF_DRAG_MIME) || dataTransfer.getData('text/plain')
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isAssetDragRef)
  } catch {
    return []
  }
}
