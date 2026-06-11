import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { LayerDef, ProjectDoc } from '../../types'
import { DEFAULT_LAYERS } from '../../constants/scene-layers'

function getLayers(project: ProjectDoc): LayerDef[] {
  return project.layers && project.layers.length > 0 ? project.layers : DEFAULT_LAYERS
}

function fallbackLayer(layers: LayerDef[]): string {
  return layers[0]?.name ?? ''
}

export const layerReducer: DomainReducer = (state: CoreState, action: Action) => {
  if (!state.project) return state

  switch (action.type) {
    case 'LAYER_ADD': {
      const name = action.name.trim()
      if (!name) return state
      const layers = getLayers(state.project)
      if (layers.some((l) => l.name === name)) return state
      return {
        ...state,
        project: { ...state.project, layers: [...layers, { name }] },
        projectDirty: true,
      }
    }

    case 'LAYER_RENAME': {
      const { oldName, newName } = action
      const trimmed = newName.trim()
      if (!trimmed || trimmed === oldName) return state
      const layers = getLayers(state.project)
      if (layers.some((l) => l.name === trimmed)) return state
      const nextLayers = layers.map((l) => l.name === oldName ? { name: trimmed } : l)
      const nextEntityLayers: Record<number, string> = {}
      for (const [id, name] of Object.entries(state.entityDisplayLayers)) {
        nextEntityLayers[Number(id)] = name === oldName ? trimmed : name
      }
      return {
        ...state,
        project: { ...state.project, layers: nextLayers },
        projectDirty: true,
        entityDisplayLayers: nextEntityLayers,
        editorActiveLayer: state.editorActiveLayer === oldName ? trimmed : state.editorActiveLayer,
        inspectorLayerName: state.inspectorLayerName === oldName ? trimmed : state.inspectorLayerName,
      }
    }

    case 'LAYER_DELETE': {
      const layers = getLayers(state.project)
      if (layers.length <= 1) return state
      const nextLayers = layers.filter((l) => l.name !== action.name)
      const fallback = fallbackLayer(nextLayers)
      const nextEntityLayers: Record<number, string> = {}
      for (const [id, name] of Object.entries(state.entityDisplayLayers)) {
        nextEntityLayers[Number(id)] = name === action.name ? fallback : name
      }
      return {
        ...state,
        project: { ...state.project, layers: nextLayers },
        projectDirty: true,
        entityDisplayLayers: nextEntityLayers,
        editorActiveLayer: state.editorActiveLayer === action.name ? fallback : state.editorActiveLayer,
        inspectorLayerName: state.inspectorLayerName === action.name ? null : state.inspectorLayerName,
      }
    }

    case 'LAYER_MOVE': {
      const layers = getLayers(state.project)
      const idx = layers.findIndex((l) => l.name === action.name)
      if (idx < 0) return state
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= layers.length) return state
      const nextLayers = [...layers]
      ;[nextLayers[idx], nextLayers[swapIdx]] = [nextLayers[swapIdx]!, nextLayers[idx]!]
      return {
        ...state,
        project: { ...state.project, layers: nextLayers },
        projectDirty: true,
      }
    }

    default:
      return state
  }
}
