import type { TilemapLayer, TilesetSourceRef } from '../types/tilemap'

export type EnsureSourceResult = Readonly<{
  layer: TilemapLayer
  sourceIndex: number
  added: boolean
}>

/**
 * Migrate legacy single-tileset layers to tilesetSources + sourceIndices.
 * Idempotent when sources are already present.
 */
export function normalizeTilemapLayer(layer: TilemapLayer): TilemapLayer {
  const cols = layer.cols ?? 0
  const rows = layer.rows ?? 0
  const size = cols * rows
  let data = layer.data?.slice() ?? new Array(size).fill(0)
  if (data.length !== size) {
    const fixed = new Array(size).fill(0)
    for (let i = 0; i < Math.min(data.length, size); i++) fixed[i] = data[i] ?? 0
    data = fixed
  }

  let sources: TilesetSourceRef[] = layer.tilesetSources
    ? layer.tilesetSources.map((s) => ({ tilesetAssetId: s.tilesetAssetId }))
    : []

  if (sources.length === 0 && layer.tilesetAssetId?.trim()) {
    sources = [{ tilesetAssetId: layer.tilesetAssetId.trim() }]
  }

  let sourceIndices = layer.sourceIndices?.slice()
  if (!sourceIndices || sourceIndices.length !== size) {
    sourceIndices = new Array(size).fill(0)
    const legacySource = sources.length > 0 ? 1 : 0
    for (let i = 0; i < size; i++) {
      if (data[i] !== 0) sourceIndices[i] = legacySource
    }
  }

  const out: TilemapLayer = {
    ...layer,
    data,
    sourceIndices,
  }
  if (sources.length > 0) out.tilesetSources = sources
  return out
}

/**
 * Resolve 1-based sourceIndex for @p tilesetAssetId on @p layer.
 * Appends to tilesetSources when the tileset is not yet registered on the layer.
 */
export function ensureSourceOnLayer(
  layer: TilemapLayer,
  tilesetAssetId: string,
): EnsureSourceResult {
  const id = tilesetAssetId.trim()
  if (!id) throw new Error('tilesetAssetId is required')

  const normalized = normalizeTilemapLayer(layer)
  const sources = [...(normalized.tilesetSources ?? [])]
  const existingIdx = sources.findIndex((s) => s.tilesetAssetId === id)
  if (existingIdx >= 0) {
    return {
      layer: normalized,
      sourceIndex: existingIdx + 1,
      added: false,
    }
  }

  sources.push({ tilesetAssetId: id })
  return {
    layer: { ...normalized, tilesetSources: sources },
    sourceIndex: sources.length,
    added: true,
  }
}

/** Tileset asset ids referenced by painted cells on @p layer. */
export function sourcesUsedOnLayer(layer: TilemapLayer): string[] {
  const normalized = normalizeTilemapLayer(layer)
  const sources = normalized.tilesetSources ?? []
  const used = new Set<string>()
  const indices = normalized.sourceIndices ?? []
  for (let i = 0; i < indices.length; i++) {
    const src = indices[i] ?? 0
    if (src <= 0 || normalized.data[i] === 0) continue
    const ref = sources[src - 1]
    if (ref?.tilesetAssetId) used.add(ref.tilesetAssetId)
  }
  return [...used]
}

/** True when any cell uses @p sourceIndex (1-based). */
export function layerSourceHasCells(layer: TilemapLayer, sourceIndex: number): boolean {
  if (sourceIndex <= 0) return false
  const normalized = normalizeTilemapLayer(layer)
  const indices = normalized.sourceIndices ?? []
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] === sourceIndex && normalized.data[i] !== 0) return true
  }
  return false
}

/**
 * Remove a 1-based sourceIndex from the layer when no cells reference it.
 * @returns null when cells still reference the source (destructive guard).
 */
export function removeSourceFromLayer(
  layer: TilemapLayer,
  sourceIndex: number,
): TilemapLayer | null {
  if (layerSourceHasCells(layer, sourceIndex)) return null
  const normalized = normalizeTilemapLayer(layer)
  const sources = [...(normalized.tilesetSources ?? [])]
  if (sourceIndex <= 0 || sourceIndex > sources.length) return normalized

  sources.splice(sourceIndex - 1, 1)
  const indices = (normalized.sourceIndices ?? []).map((idx) => {
    if (idx === 0) return 0
    if (idx === sourceIndex) return 0
    if (idx > sourceIndex) return idx - 1
    return idx
  })

  const next: TilemapLayer = {
    ...normalized,
    sourceIndices: indices,
    tilesetSources: sources.length > 0 ? sources : undefined,
  }
  if (sources.length === 0) {
    delete next.tilesetSources
  }
  return next
}

/** Remove @p tilesetAssetId from a layer grid (sources list + painted cells). */
export function scrubTilesetFromLayer(
  layer: TilemapLayer,
  tilesetAssetId: string,
): TilemapLayer {
  const id = tilesetAssetId.trim()
  const normalized = normalizeTilemapLayer(layer)
  const sources = [...(normalized.tilesetSources ?? [])]
  const removeAt = sources.findIndex((s) => s.tilesetAssetId === id)
  if (removeAt < 0) {
    if (normalized.tilesetAssetId === id) {
      const { tilesetAssetId: _drop, ...rest } = normalized
      return rest
    }
    return normalized
  }

  const removedIndex = removeAt + 1
  sources.splice(removeAt, 1)
  const data = normalized.data.slice()
  const sourceIndices = (normalized.sourceIndices ?? new Array(data.length).fill(0)).slice()
  for (let i = 0; i < data.length; i++) {
    const idx = sourceIndices[i] ?? 0
    if (idx === removedIndex) {
      data[i] = 0
      sourceIndices[i] = 0
    } else if (idx > removedIndex) {
      sourceIndices[i] = idx - 1
    }
  }

  const next: TilemapLayer = {
    ...normalized,
    data,
    sourceIndices,
    tilesetSources: sources.length > 0 ? sources : undefined,
  }
  if (normalized.tilesetAssetId === id) delete next.tilesetAssetId
  if (normalized.defaultTilesetAssetId === id) delete next.defaultTilesetAssetId
  if (!next.tilesetSources?.length) delete next.tilesetSources
  return next
}

export function tilesetIdForSourceIndex(
  layer: TilemapLayer,
  sourceIndex: number,
): string | undefined {
  if (sourceIndex <= 0) return undefined
  const sources = layer.tilesetSources ?? []
  return sources[sourceIndex - 1]?.tilesetAssetId
}

/** Collect all tileset asset ids declared or referenced on a layer. */
export function tilesetIdsOnLayer(layer: TilemapLayer): string[] {
  const normalized = normalizeTilemapLayer(layer)
  const ids = new Set<string>()
  for (const s of normalized.tilesetSources ?? []) {
    if (s.tilesetAssetId?.trim()) ids.add(s.tilesetAssetId.trim())
  }
  for (const id of sourcesUsedOnLayer(normalized)) ids.add(id)
  if (normalized.tilesetAssetId?.trim()) ids.add(normalized.tilesetAssetId.trim())
  return [...ids]
}
