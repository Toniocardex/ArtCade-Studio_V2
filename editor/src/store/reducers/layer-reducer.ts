import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { EntityDef, LayerDef, ProjectDoc } from '../../types'
import {
  DEFAULT_LAYERS,
  hasLayerBackground,
  hasParallax,
  layerLocked,
  layerOpacity,
  layerVisible,
} from '../../constants/scene-layers'

function getLayers(project: ProjectDoc): LayerDef[] {
  return project.layers && project.layers.length > 0 ? project.layers : DEFAULT_LAYERS
}

/** Persist a render-layer assignment for one instance id (scene instance + entity cache). */
function assignEntityLayer(project: ProjectDoc, entityId: number, layer: string): ProjectDoc {
  let touched = false
  const scenes = Object.fromEntries(
    Object.entries(project.scenes).map(([sid, scene]) => {
      if (!scene.instances?.some((i) => i.id === entityId && i.layer !== layer)) return [sid, scene]
      touched = true
      return [sid, {
        ...scene,
        instances: scene.instances.map((i) => (i.id === entityId ? { ...i, layer } : i)),
      }]
    }),
  )
  const ent = project.entities[entityId]
  const entities = ent && ent.layer !== layer
    ? { ...project.entities, [entityId]: { ...ent, layer } }
    : project.entities
  if (!touched && entities === project.entities) return project
  return { ...project, scenes, entities }
}

/** Rewrite every `from` layer reference to `to` across instances + entity cache. */
function remapLayerRefs(project: ProjectDoc, from: string, to: string): ProjectDoc {
  let touched = false
  const scenes = Object.fromEntries(
    Object.entries(project.scenes).map(([sid, scene]) => {
      if (!scene.instances?.some((i) => i.layer === from)) return [sid, scene]
      touched = true
      return [sid, {
        ...scene,
        instances: scene.instances.map((i) => (i.layer === from ? { ...i, layer: to } : i)),
      }]
    }),
  )
  let eTouched = false
  const entities: Record<number, EntityDef> = {}
  for (const [id, ent] of Object.entries(project.entities)) {
    if (ent.layer === from) { eTouched = true; entities[Number(id)] = { ...ent, layer: to } }
    else entities[Number(id)] = ent
  }
  if (!touched && !eTouched) return project
  return { ...project, scenes, entities: eTouched ? entities : project.entities }
}

/** Drop neutral parallax / empty background so project.json stays lean. */
function normalizeLayer(layer: LayerDef): LayerDef {
  const out: LayerDef = { name: layer.name }
  if (!layerVisible(layer)) out.visible = false
  if (layerLocked(layer)) out.locked = true
  const opacity = layerOpacity(layer)
  if (opacity !== 1) out.opacity = opacity
  if (layer.parallax && hasParallax(layer)) out.parallax = layer.parallax
  if (layer.background && hasLayerBackground(layer)) out.background = layer.background
  return out
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
        project: { ...state.project, layers: [{ name }, ...layers] },
        projectDirty: true,
      }
    }

    case 'LAYER_RENAME': {
      const { oldName, newName } = action
      const trimmed = newName.trim()
      if (!trimmed || trimmed === oldName) return state
      const layers = getLayers(state.project)
      if (layers.some((l) => l.name === trimmed)) return state
      const nextLayers = layers.map((l) => l.name === oldName ? { ...l, name: trimmed } : l)
      const nextEntityLayers: Record<number, string> = {}
      for (const [id, name] of Object.entries(state.entityDisplayLayers)) {
        nextEntityLayers[Number(id)] = name === oldName ? trimmed : name
      }
      const renamed = remapLayerRefs({ ...state.project, layers: nextLayers }, oldName, trimmed)
      return {
        ...state,
        project: renamed,
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
      const remapped = remapLayerRefs({ ...state.project, layers: nextLayers }, action.name, fallback)
      return {
        ...state,
        project: remapped,
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

    case 'LAYER_UPDATE': {
      const layers = getLayers(state.project)
      const idx = layers.findIndex((l) => l.name === action.name)
      if (idx < 0) return state
      const merged = normalizeLayer({ ...layers[idx]!, ...action.patch })
      const nextLayers = layers.map((l, i) => (i === idx ? merged : l))
      return {
        ...state,
        project: { ...state.project, layers: nextLayers },
        projectDirty: true,
      }
    }

    // ui-reducer already updated the ephemeral display map + active/inspector
    // layer; here we persist the assignment onto the scene instance + entity
    // cache so it survives save/reload and reaches the runtime.
    case 'ENTITY_SET_DISPLAY_LAYER': {
      const project = assignEntityLayer(state.project, action.entityId, action.layerName)
      if (project === state.project) return state
      return { ...state, project, projectDirty: true }
    }

    default:
      return state
  }
}
