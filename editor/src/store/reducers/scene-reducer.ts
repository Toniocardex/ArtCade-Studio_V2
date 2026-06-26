// ---------------------------------------------------------------------------
// reducers/scene-reducer — scene-, tilemap- and asset-level mutations
// ---------------------------------------------------------------------------
//
// Scene size + viewport, tilemap CRUD, tileset and image asset registries.
// Anything that affects the renderer-visible layout of a scene lives here.

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import { DEFAULT_WORLD, createTilemap, createTilemapForNewLayer, resizeTilemap, mergeTilemapLayers, resizeTilemapForTileSize, resolveTilemapTileSize } from '../../types'
import type { AnimationClipDef, CollisionProfileDef, EntityDef, SceneDef, SpriteComponent, TilemapLayer } from '../../types'
import { DEFAULT_LAYERS } from '../../constants/scene-layers'
import { createSceneDef, uniqueSceneName, nextEntityId } from '../../utils/project'
import { clampEntityPositionToScene, snapToGridValue } from '../../utils/entity-position'
import { clampCameraStart } from '../../utils/camera-start'
import { projectAfterRemovingAsset } from '../../utils/strip-project-asset-refs'
import { normalizeAssetRefs } from '../../utils/normalize-asset-refs'
import { ensureSourceOnLayer, normalizeTilemapLayer } from '../../utils/tilemap-layer-sources'
import {
  isGeneratedPrototypeAsset,
  prototypeOwnerTypeIdFromAsset,
  resetPrototypeSpriteAsset,
  clearSpriteClipFields,
  patchObjectTypeSpritesUsingAsset,
  syncGeneratedPrototypeAsset,
} from '../../utils/prototype-sprite'
import { rematerializeAllInstancesOfType } from '../../utils/project-object-types'
import {
  applyClipDefaultsForImageAsset,
  detachImageAssetFromSprites,
} from '../../utils/sprite-asset-ref'

export const sceneReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'PROJECT_NORMALIZE_ASSET_REFS': {
      if (!state.project) return state
      const { project, changed } = normalizeAssetRefs(state.project)
      if (changed === 0) return state
      return { ...state, project, projectDirty: true }
    }
    case 'WORLD_SET': {
      if (!state.project) return state
      const world = { ...DEFAULT_WORLD, ...state.project.world, ...action.patch }
      return {
        ...state,
        project: { ...state.project, world },
        projectDirty: true,
      }
    }
    case 'SCENE_ADD_EMPTY': {
      if (!state.project) return state
      const sourceSceneId = action.sourceSceneId ?? state.selection.sceneId ?? state.project.activeSceneId
      const sourceScene = state.project.scenes?.[sourceSceneId]
      const scene = createSceneDef(state.project, sourceScene, action.name)
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [scene.id]: scene,
          },
        },
        selection: { sceneId: scene.id, entityId: null, entityIds: [] },
        projectDirty: true,
      }
    }
    case 'SCENE_RENAME': {
      const scene = state.project?.scenes?.[action.sceneId]
      if (!state.project || !scene) return state
      const name = uniqueSceneName(state.project, action.name, action.sceneId)
      if (!name || name === scene.name) return state
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...scene, name },
          },
        },
        projectDirty: true,
      }
    }
    case 'SCENE_SET_START': {
      if (!state.project || !state.project.scenes?.[action.sceneId]) return state
      if (state.project.activeSceneId === action.sceneId) return state
      return {
        ...state,
        project: { ...state.project, activeSceneId: action.sceneId },
        projectDirty: true,
      }
    }
    case 'SCENE_DUPLICATE': {
      const srcScene = state.project?.scenes?.[action.sceneId]
      if (!state.project || !srcScene) return state
      const newSceneMeta = createSceneDef(state.project, srcScene, `${srcScene.name} Copy`)
      const entities = { ...state.project.entities }
      const idMap = new Map<number, number>()
      const newEntityIds: number[] = []

      for (const eid of srcScene.entityIds) {
        const ent = state.project.entities?.[eid]
        if (!ent) continue
        const newId = nextEntityId({ ...state.project, entities })
        const clone: EntityDef = JSON.parse(JSON.stringify(ent))
        clone.id = newId
        entities[newId] = clone
        newEntityIds.push(newId)
        idMap.set(eid, newId)
      }

      const instances = srcScene.instances?.map((inst) => {
        const mapped = idMap.get(inst.id)
        if (mapped == null) return null
        return { ...inst, id: mapped }
      }).filter((i): i is NonNullable<typeof i> => i != null)

      const duplicated: SceneDef = {
        ...srcScene,
        id: newSceneMeta.id,
        name: newSceneMeta.name,
        entityIds: newEntityIds,
        ...(instances ? { instances } : {}),
        ...(srcScene.tilemap
          ? { tilemap: JSON.parse(JSON.stringify(srcScene.tilemap)) }
          : {}),
      }

      // Boards target object types: the duplicated instances share the same
      // types, so existing boards already cover them — nothing to clone.
      return {
        ...state,
        project: {
          ...state.project,
          entities,
          scenes: {
            ...state.project.scenes,
            [duplicated.id]: duplicated,
          },
        },
        selection: { sceneId: duplicated.id, entityId: null, entityIds: [] },
        projectDirty: true,
      }
    }
    case 'SCENE_DELETE': {
      const project = state.project
      const scene = project?.scenes?.[action.sceneId]
      if (!project || !scene) return state
      if (Object.keys(project.scenes ?? {}).length <= 1) return state
      if (project.activeSceneId === action.sceneId) return state

      const remainingScenes = Object.fromEntries(
        Object.entries(project.scenes ?? {}).filter(([sid]) => sid !== action.sceneId),
      )
      const remainingReferencedEntityIds = new Set(
        Object.values(remainingScenes).flatMap((sc) => sc.entityIds),
      )
      const removedEntityIds = new Set(
        scene.entityIds.filter((id) => !remainingReferencedEntityIds.has(id)),
      )
      const entities = Object.fromEntries(
        Object.entries(project.entities ?? {}).filter(([id]) => !removedEntityIds.has(Number(id))),
      )
      const thumbnails = project.thumbnails
        ? Object.fromEntries(
            Object.entries(project.thumbnails).filter(([sid]) => sid !== action.sceneId),
          )
        : undefined
      const nextSceneId =
        state.selection.sceneId === action.sceneId
          ? Object.keys(remainingScenes)[0] ?? project.activeSceneId
          : state.selection.sceneId
      const entityIds = (state.selection.entityIds ?? []).filter(
        (id) => !removedEntityIds.has(id),
      )

      return {
        ...state,
        project: {
          ...project,
          entities,
          scenes: remainingScenes,
          ...(project.thumbnails != null
            ? { thumbnails: Object.keys(thumbnails ?? {}).length > 0 ? thumbnails : undefined }
            : {}),
        },
        selection: {
          sceneId: nextSceneId,
          entityId:
            state.selection.entityId != null && removedEntityIds.has(state.selection.entityId)
              ? (entityIds.length > 0 ? entityIds[entityIds.length - 1] : null)
              : state.selection.entityId,
          entityIds,
        },
        projectDirty: true,
      }
    }
    case 'SCENE_SET_WORLD_SIZE': {
      const sc = state.project?.scenes?.[action.sceneId]
      if (!state.project || !sc) return state
      const worldSize = { x: action.x, y: action.y }
      if (sc.worldSize.x === worldSize.x && sc.worldSize.y === worldSize.y) return state
      const scaleX = sc.worldSize.x > 0 ? worldSize.x / sc.worldSize.x : 1
      const scaleY = sc.worldSize.y > 0 ? worldSize.y / sc.worldSize.y : 1
      const resizedEntityIds = new Set(sc.entityIds)
      const entities = Object.fromEntries(
        Object.entries(state.project.entities ?? {}).map(([id, entity]) => {
          if (!resizedEntityIds.has(Number(id))) return [id, entity]
          const position = clampEntityPositionToScene({
            x: entity.transform.position.x * scaleX,
            y: entity.transform.position.y * scaleY,
          }, worldSize)
          return [id, {
            ...entity,
            transform: {
              ...entity.transform,
              position,
            },
          }]
        }),
      )
      return {
        ...state,
        project: {
          ...state.project,
          entities,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: {
              ...sc,
              worldSize,
              ...(sc.tilemap ? { tilemap: resizeTilemap(sc.tilemap, worldSize.x, worldSize.y) } : {}),
            },
          },
        },
        projectDirty: true,
      }
    }
    case 'SCENE_SET_VIEWPORT_SIZE': {
      const sc = state.project?.scenes?.[action.sceneId]
      if (!state.project || !sc) return state
      const viewportSize = { x: action.x, y: action.y }
      if (sc.viewportSize.x === viewportSize.x && sc.viewportSize.y === viewportSize.y) return state
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, viewportSize },
          },
        },
        projectDirty: true,
      }
    }
    case 'SCENE_SET_CAMERA_START': {
      const sc = state.project?.scenes?.[action.sceneId]
      if (!state.project || !sc) return state
      const snapped = state.snapToGrid
        ? {
            x: snapToGridValue(action.x, state.editorGridSize),
            y: snapToGridValue(action.y, state.editorGridSize),
          }
        : { x: action.x, y: action.y }
      const cameraStart = clampCameraStart(sc.worldSize, sc.viewportSize, snapped)
      const prev = sc.cameraStart ?? { x: 0, y: 0 }
      if (prev.x === cameraStart.x && prev.y === cameraStart.y) return state
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, cameraStart },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILEMAP_INIT': {
      const sc = state.project?.scenes?.[action.sceneId]
      if (!state.project || !sc) return state
      const tm = createTilemap(sc.worldSize.x, sc.worldSize.y)
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, tilemap: tm },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILEMAP_PAINT': {
      const sc = state.project?.scenes?.[action.sceneId]
      if (!state.project || !sc) return state
      // auto-create the layer on first paint
      const tm = sc.tilemap ?? createTilemap(sc.worldSize.x, sc.worldSize.y)
      if (action.index < 0 || action.index >= tm.data.length) return state
      if (tm.data[action.index] === action.tileId && sc.tilemap) return state
      const data = tm.data.slice()
      data[action.index] = action.tileId
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, tilemap: { ...tm, data } },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILEMAP_PAINT_CELL': {
      const sc = state.project?.scenes?.[action.sceneId]
      if (!state.project || !sc) return state
      const layerId = state.editorActiveLayerId
      const existingLayerTm = sc.tilemapLayers?.[layerId]
      const tileSize = existingLayerTm
        ? existingLayerTm.tileSize
        : resolveTilemapTileSize(state.project, sc, action.tilesetAssetId)
      const layerTm = existingLayerTm ?? createTilemapForNewLayer(
        sc.worldSize.x,
        sc.worldSize.y,
        tileSize,
        sc,
      )
      if (action.col < 0 || action.col >= layerTm.cols ||
          action.row < 0 || action.row >= layerTm.rows) return state
      const index = action.row * layerTm.cols + action.col
      const tileId = action.tileId
      const size = layerTm.cols * layerTm.rows

      let workingLayer = normalizeTilemapLayer(layerTm)
      let sourceIndex = 0
      let sourceAdded = false
      if (tileId > 0) {
        const ensured = ensureSourceOnLayer(workingLayer, action.tilesetAssetId)
        workingLayer = ensured.layer
        sourceIndex = ensured.sourceIndex
        sourceAdded = ensured.added
      }

      const data = workingLayer.data.slice()
      const sourceIndices = (workingLayer.sourceIndices ?? new Array(size).fill(0)).slice()
      if (data[index] === tileId && sourceIndices[index] === (tileId > 0 ? sourceIndex : 0)) {
        return state
      }
      data[index] = tileId
      sourceIndices[index] = tileId > 0 ? sourceIndex : 0

      const updatedLayerTm: TilemapLayer = {
        ...workingLayer,
        data,
        sourceIndices,
      }
      const tilemapLayers = { ...(sc.tilemapLayers ?? {}), [layerId]: updatedLayerTm }
      const layers = state.project.layers ?? DEFAULT_LAYERS
      const layerIds = layers.map(l => l.id)
      const merged = mergeTilemapLayers(layerIds, tilemapLayers) ?? updatedLayerTm
      const tilesetName =
        state.project.tilesets?.[action.tilesetAssetId]?.name ?? action.tilesetAssetId
      const layerLabel = layers.find(l => l.id === layerId)?.name ?? layerId
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, tilemapLayers, tilemap: merged },
          },
        },
        projectDirty: true,
        paintSourceNotice: sourceAdded
          ? `${tilesetName} added to ${layerLabel} sources`
          : state.paintSourceNotice,
      }
    }
    case 'TILESET_ASSET_ADD': {
      if (!state.project) return state
      return {
        ...state,
        project: {
          ...state.project,
          tilesets: {
            ...(state.project.tilesets ?? {}),
            [action.asset.assetId]: action.asset,
          },
        },
        projectDirty: true,
      }
    }
    case 'TILESET_ASSET_REMOVE': {
      const project = state.project
      if (!project?.tilesets?.[action.assetId]) return state
      return {
        ...state,
        project: projectAfterRemovingAsset(project, {
          kind: 'tileset',
          id: action.assetId,
        }),
        projectDirty: true,
      }
    }
    case 'ASSET_ADD': {
      if (!state.project) return state
      const storedAsset = isGeneratedPrototypeAsset(action.asset)
        ? syncGeneratedPrototypeAsset(
          action.asset,
          prototypeOwnerTypeIdFromAsset(action.asset),
        )
        : action.asset
      const withAsset = {
        ...state.project,
        assets: {
          ...(state.project.assets ?? {}),
          [storedAsset.id]: storedAsset,
        },
      }
      const project = storedAsset.usage === 'sprite'
        ? withAsset
        : detachImageAssetFromSprites(withAsset, {
            id: storedAsset.id,
            path: storedAsset.path,
          })
      return {
        ...state,
        project,
        projectDirty: true,
      }
    }
    case 'IMAGE_ASSET_RESET_PROTOTYPE': {
      const existing = state.project?.assets?.[action.assetId]
      if (!state.project || !existing || !isGeneratedPrototypeAsset(existing)) return state
      const resetAsset = resetPrototypeSpriteAsset({
        asset: existing,
        typeId: action.typeId,
        typeName: action.typeName,
      })
      const collisionProfiles = { ...(state.project.collisionProfiles ?? {}) }
      delete collisionProfiles[action.assetId]
      let project: NonNullable<CoreState['project']> = {
        ...state.project,
        assets: { ...state.project.assets, [action.assetId]: resetAsset },
        collisionProfiles: Object.keys(collisionProfiles).length > 0 ? collisionProfiles : undefined,
      }
      const patched = patchObjectTypeSpritesUsingAsset(
        project,
        action.assetId,
        clearSpriteClipFields,
      )
      project = patched.project
      for (const typeId of patched.typeIds) {
        project = rematerializeAllInstancesOfType(project, typeId)
      }
      return {
        ...state,
        project,
        projectDirty: true,
      }
    }
    case 'IMAGE_ASSET_SET_CLIPS': {
      const existing = state.project?.assets?.[action.assetId]
      if (!state.project || !existing) return state
      const projectWithClips = {
        ...state.project,
        assets: {
          ...state.project.assets,
          [action.assetId]: { ...existing, clips: action.clips },
        },
      }
      return {
        ...state,
        project: applyClipDefaultsForImageAsset(
          projectWithClips,
          { id: existing.id, path: existing.path },
          action.clips,
        ),
        projectDirty: true,
      }
    }
    case 'COLLISION_PROFILE_SET': {
      if (!state.project) return state
      const asset = state.project.assets?.[action.assetId]
      if (!asset) return state
      const profile: CollisionProfileDef = {
        ...action.profile,
        id: action.assetId,
        name: action.profile.name || asset.name,
      }
      return {
        ...state,
        project: {
          ...state.project,
          collisionProfiles: {
            ...(state.project.collisionProfiles ?? {}),
            [action.assetId]: profile,
          },
        },
        projectDirty: true,
      }
    }
    case 'AUDIO_ASSET_ADD': {
      if (!state.project) return state
      return {
        ...state,
        project: {
          ...state.project,
          audioAssets: {
            ...(state.project.audioAssets ?? {}),
            [action.asset.id]: action.asset,
          },
        },
        projectDirty: true,
      }
    }
    case 'AUDIO_ASSET_REMOVE': {
      const project = state.project
      const entry = project?.audioAssets?.[action.assetId]
      if (!project || !entry) return state
      return {
        ...state,
        project: projectAfterRemovingAsset(project, {
          kind: 'audio',
          id: action.assetId,
          path: entry.path,
        }),
        projectDirty: true,
      }
    }
    case 'FONT_ASSET_ADD': {
      if (!state.project) return state
      return {
        ...state,
        project: {
          ...state.project,
          fontAssets: {
            ...(state.project.fontAssets ?? {}),
            [action.asset.id]: action.asset,
          },
        },
        projectDirty: true,
      }
    }
    case 'FONT_ASSET_REMOVE': {
      const project = state.project
      const entry = project?.fontAssets?.[action.assetId]
      if (!project || !entry) return state
      return {
        ...state,
        project: projectAfterRemovingAsset(project, {
          kind: 'font',
          id: action.assetId,
          path: entry.path,
        }),
        projectDirty: true,
      }
    }
    case 'ASSET_REMOVE': {
      const project = state.project
      const removed = project?.assets?.[action.assetId]
      if (!project || !removed) return state
      return {
        ...state,
        project: projectAfterRemovingAsset(project, {
          kind: 'image',
          id: action.assetId,
          path: removed.path,
        }),
        projectDirty: true,
      }
    }
    case 'TILEMAP_SET_TILESETID': {
      const sc = state.project?.scenes?.[action.sceneId]
      if (!state.project || !sc) return state
      const layerId = state.editorActiveLayerId
      const existing = sc.tilemapLayers?.[layerId]
      const tileSize = existing
        ? existing.tileSize
        : resolveTilemapTileSize(state.project, sc, action.assetId)
      const layerTm: TilemapLayer = {
        ...(existing ?? createTilemapForNewLayer(sc.worldSize.x, sc.worldSize.y, tileSize, sc)),
        defaultTilesetAssetId: action.assetId,
      }
      const tilemapLayers = { ...(sc.tilemapLayers ?? {}), [layerId]: layerTm }
      const layerIds = (state.project.layers ?? DEFAULT_LAYERS).map(l => l.id)
      const merged = mergeTilemapLayers(layerIds, tilemapLayers) ?? layerTm
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, tilemapLayers, tilemap: merged },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILEMAP_SET_TILESIZE': {
      // Resize all layer tilemaps to the new tileSize, preserving overlapping cells.
      const sc = state.project?.scenes?.[action.sceneId]
      if (!state.project || !sc) return state
      const resizeOne = (tm: TilemapLayer): TilemapLayer =>
        resizeTilemapForTileSize(tm, sc.worldSize.x, sc.worldSize.y, action.tileSize)
      const hasTilemapLayers = sc.tilemapLayers && Object.keys(sc.tilemapLayers).length > 0
      if (!hasTilemapLayers && !sc.tilemap) return state
      const tilemapLayers = hasTilemapLayers
        ? Object.fromEntries(Object.entries(sc.tilemapLayers!).map(([k, v]) => [k, resizeOne(v)]))
        : sc.tilemapLayers
      const layerIds = (state.project.layers ?? DEFAULT_LAYERS).map(l => l.id)
      const merged = tilemapLayers
        ? (mergeTilemapLayers(layerIds, tilemapLayers) ?? resizeOne(sc.tilemap!))
        : resizeOne(sc.tilemap!)
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, tilemapLayers, tilemap: merged },
          },
        },
        projectDirty: true,
      }
    }
    default:
      return state
  }
}
