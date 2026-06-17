import type { CoreState } from '../store/editor-store-state'
import type { ProjectDoc } from '../types'
import type { TilemapLayer } from '../types/tilemap'

/**
 * Tileset asset id bound to a scene layer's tilemap grid, if any.
 */
export function layerTilesetId(
  project: ProjectDoc | null,
  sceneId: string | undefined,
  layerName: string,
): string | undefined {
  if (!project || !sceneId) return undefined
  const scene = project.scenes[sceneId]
  if (!scene) return undefined
  return scene.tilemapLayers?.[layerName]?.tilesetAssetId
}

/** True when any cell in the layer grid is non-empty. */
export function layerHasPaintedCells(layer: TilemapLayer | undefined): boolean {
  if (!layer) return false
  return layer.data.some((id) => id !== 0)
}

/**
 * Whether opening @p tilesetId may assign/replace the layer binding without corrupting painted cells.
 */
export function canAssignTilesetToLayer(
  existing: TilemapLayer | undefined,
  tilesetId: string,
): boolean {
  if (!existing?.tilesetAssetId) return true
  if (existing.tilesetAssetId === tilesetId) return true
  return !layerHasPaintedCells(existing)
}

/**
 * Paint overlay is active when a tileset editor session is open and matches the active layer
 * (or the layer has no tileset yet — first paint will bind via TILEMAP_PAINT_CELL).
 */
export function isPaintSessionAligned(
  state: Pick<CoreState, 'project' | 'selection' | 'editorActiveLayer' | 'editingTilesetId'>,
): boolean {
  const editingId = state.editingTilesetId
  if (!editingId) return false
  const sceneId = state.selection.sceneId ?? state.project?.activeSceneId
  const boundId = layerTilesetId(state.project, sceneId, state.editorActiveLayer)
  if (!boundId) return true
  return boundId === editingId
}

/**
 * When switching the active layer during tileset paint, close the session if the target layer
 * is already bound to a different tileset.
 */
export function shouldClosePaintOnLayerSwitch(
  state: Pick<CoreState, 'project' | 'selection' | 'editorActiveLayer' | 'editingTilesetId'>,
  nextLayerName: string,
): boolean {
  const editingId = state.editingTilesetId
  if (!editingId) return false
  const sceneId = state.selection.sceneId ?? state.project?.activeSceneId
  const boundId = layerTilesetId(state.project, sceneId, nextLayerName)
  if (!boundId) return false
  return boundId !== editingId
}
