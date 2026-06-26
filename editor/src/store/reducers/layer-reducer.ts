import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { EntityDef, LayerDef, LayerId, ProjectDoc, SceneDef, SceneLayerSettings } from '../../types'
import { mergeTilemapLayers } from '../../types'
import {
  DEFAULT_LAYERS,
  newLayerId,
  normalizeSceneLayerSettings,
} from '../../constants/scene-layers'

function getLayers(project: ProjectDoc): LayerDef[] {
  return project.layers && project.layers.length > 0 ? project.layers : DEFAULT_LAYERS
}

function fallbackLayerId(layers: LayerDef[]): LayerId {
  return layers[0]?.id ?? ''
}

/** Write a single instance's layer assignment (scene instance + entity cache). */
function assignInstanceLayer(project: ProjectDoc, instanceId: number, layerId: LayerId): ProjectDoc {
  let touched = false
  const scenes = Object.fromEntries(
    Object.entries(project.scenes ?? {}).map(([sid, scene]) => {
      if (!scene.instances?.some((i) => i.id === instanceId && i.layerId !== layerId)) return [sid, scene]
      touched = true
      return [sid, {
        ...scene,
        instances: scene.instances.map((i) => (i.id === instanceId ? { ...i, layerId } : i)),
      }]
    }),
  )
  const ent = project.entities?.[instanceId]
  const entities = ent && ent.layerId !== layerId
    ? { ...project.entities, [instanceId]: { ...ent, layerId } }
    : project.entities
  if (!touched && entities === project.entities) return project
  return { ...project, scenes, entities }
}

/**
 * Remove a layer id everywhere: reassign orphan instances/entities to the
 * fallback layer, drop the per-scene `layerSettings` + `tilemapLayers` entries,
 * and recompute the merged tilemap for the remaining layer order.
 */
function purgeLayer(
  project: ProjectDoc,
  layers: LayerDef[],
  removedId: LayerId,
  fallbackId: LayerId,
): ProjectDoc {
  const layerIds = layers.map((l) => l.id)
  const scenes: Record<string, SceneDef> = {}
  for (const [sid, scene] of Object.entries(project.scenes ?? {})) {
    let next: SceneDef = scene
    if (scene.instances?.some((i) => i.layerId === removedId)) {
      next = {
        ...next,
        instances: scene.instances.map((i) =>
          i.layerId === removedId ? { ...i, layerId: fallbackId } : i,
        ),
      }
    }
    if (scene.layerSettings && removedId in scene.layerSettings) {
      const { [removedId]: _dropped, ...rest } = scene.layerSettings
      next = { ...next, layerSettings: Object.keys(rest).length > 0 ? rest : undefined }
    }
    if (scene.tilemapLayers && removedId in scene.tilemapLayers) {
      const { [removedId]: _droppedTm, ...restTm } = scene.tilemapLayers
      const tilemapLayers = Object.keys(restTm).length > 0 ? restTm : undefined
      next = {
        ...next,
        tilemapLayers,
        tilemap: tilemapLayers ? (mergeTilemapLayers(layerIds, tilemapLayers) ?? next.tilemap) : next.tilemap,
      }
    }
    scenes[sid] = next
  }
  const entities: Record<number, EntityDef> = {}
  let eTouched = false
  for (const [id, ent] of Object.entries(project.entities ?? {})) {
    if (ent.layerId === removedId) { eTouched = true; entities[Number(id)] = { ...ent, layerId: fallbackId } }
    else entities[Number(id)] = ent
  }
  return { ...project, scenes, entities: eTouched ? entities : project.entities }
}

/** Merge a per-scene layer-settings patch, dropping neutral settings to keep scenes lean. */
function updateSceneLayerSettings(
  project: ProjectDoc,
  sceneId: string,
  layerId: LayerId,
  patch: Partial<SceneLayerSettings>,
): ProjectDoc {
  const scene = project.scenes?.[sceneId]
  if (!scene) return project
  const current = scene.layerSettings?.[layerId] ?? {}
  const normalized = normalizeSceneLayerSettings({ ...current, ...patch })
  const nextSettings: Record<LayerId, SceneLayerSettings> = { ...(scene.layerSettings ?? {}) }
  if (normalized) nextSettings[layerId] = normalized
  else delete nextSettings[layerId]
  return {
    ...project,
    scenes: {
      ...project.scenes,
      [sceneId]: {
        ...scene,
        layerSettings: Object.keys(nextSettings).length > 0 ? nextSettings : undefined,
      },
    },
  }
}

export const layerReducer: DomainReducer = (state: CoreState, action: Action) => {
  if (!state.project) return state

  switch (action.type) {
    case 'LAYER_ADD': {
      const name = action.name.trim()
      if (!name) return state
      const layers = getLayers(state.project)
      if (layers.some((l) => l.name === name)) return state
      const id = newLayerId()
      return {
        ...state,
        project: { ...state.project, layers: [{ id, name }, ...layers] },
        editorActiveLayerId: id,
        inspectorLayerId: id,
        projectDirty: true,
      }
    }

    case 'LAYER_RENAME': {
      const name = action.name.trim()
      if (!name) return state
      const layers = getLayers(state.project)
      const target = layers.find((l) => l.id === action.layerId)
      if (!target || target.name === name) return state
      if (layers.some((l) => l.id !== action.layerId && l.name === name)) return state
      const nextLayers = layers.map((l) => (l.id === action.layerId ? { ...l, name } : l))
      return {
        ...state,
        project: { ...state.project, layers: nextLayers },
        projectDirty: true,
      }
    }

    case 'LAYER_DELETE': {
      const layers = getLayers(state.project)
      if (layers.length <= 1 || !layers.some((l) => l.id === action.layerId)) return state
      const nextLayers = layers.filter((l) => l.id !== action.layerId)
      const fallback = fallbackLayerId(nextLayers)
      const purged = purgeLayer(
        { ...state.project, layers: nextLayers },
        nextLayers,
        action.layerId,
        fallback,
      )
      return {
        ...state,
        project: purged,
        projectDirty: true,
        editorActiveLayerId: state.editorActiveLayerId === action.layerId ? fallback : state.editorActiveLayerId,
        inspectorLayerId: state.inspectorLayerId === action.layerId ? null : state.inspectorLayerId,
      }
    }

    case 'LAYER_MOVE': {
      const layers = getLayers(state.project)
      const idx = layers.findIndex((l) => l.id === action.layerId)
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

    case 'LAYER_SET_LOCKED': {
      const layers = getLayers(state.project)
      const idx = layers.findIndex((l) => l.id === action.layerId)
      if (idx < 0) return state
      const layer = layers[idx]!
      if ((layer.locked === true) === action.locked) return state
      const nextLayer: LayerDef = action.locked
        ? { ...layer, locked: true }
        : { id: layer.id, name: layer.name }
      const nextLayers = layers.map((l, i) => (i === idx ? nextLayer : l))
      return {
        ...state,
        project: { ...state.project, layers: nextLayers },
        projectDirty: true,
      }
    }

    case 'SCENE_LAYER_SETTINGS_UPDATE': {
      const project = updateSceneLayerSettings(state.project, action.sceneId, action.layerId, action.patch)
      if (project === state.project) return state
      return { ...state, project, projectDirty: true }
    }

    case 'INSTANCE_SET_LAYER': {
      const project = assignInstanceLayer(state.project, action.instanceId, action.layerId)
      if (project === state.project) return state
      return { ...state, project, projectDirty: true }
    }

    default:
      return state
  }
}
