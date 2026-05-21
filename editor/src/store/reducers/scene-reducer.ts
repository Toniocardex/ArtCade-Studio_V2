// ---------------------------------------------------------------------------
// reducers/scene-reducer — scene-, tilemap- and asset-level mutations
// ---------------------------------------------------------------------------
//
// Scene size + viewport, tilemap CRUD, tileset and image asset registries.
// Anything that affects the renderer-visible layout of a scene lives here.

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import { DEFAULT_WORLD, createTilemap, resizeTilemap } from '../../types'

export const sceneReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'WORLD_SET': {
      if (!state.project) return state
      const world = { ...DEFAULT_WORLD, ...state.project.world, ...action.patch }
      return {
        ...state,
        project: { ...state.project, world },
        projectDirty: true,
      }
    }
    case 'SCENE_SET_WORLD_SIZE': {
      const sc = state.project?.scenes[action.sceneId]
      if (!state.project || !sc) return state
      const worldSize = { x: action.x, y: action.y }
      if (sc.worldSize.x === worldSize.x && sc.worldSize.y === worldSize.y) return state
      return {
        ...state,
        project: {
          ...state.project,
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
      const sc = state.project?.scenes[action.sceneId]
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
    case 'TILEMAP_INIT': {
      const sc = state.project?.scenes[action.sceneId]
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
      const sc = state.project?.scenes[action.sceneId]
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
      // C++ painting sends (col,row); resolve to index using the layer cols.
      const sc = state.project?.scenes[action.sceneId]
      if (!state.project || !sc?.tilemap) return state
      const tm = sc.tilemap
      if (action.col < 0 || action.col >= tm.cols ||
          action.row < 0 || action.row >= tm.rows) return state
      const index = action.row * tm.cols + action.col
      if (tm.data[index] === action.tileId) return state
      const data = tm.data.slice()
      data[index] = action.tileId
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
      if (!state.project || !state.project.tilesets) return state
      const tilesets = Object.fromEntries(
        Object.entries(state.project.tilesets).filter(
          ([k]) => k !== action.assetId,
        ),
      )
      // detach from any scene that referenced it
      const scenes = Object.fromEntries(
        Object.entries(state.project.scenes).map(([sid, sc]) => {
          if (sc.tilemap?.tilesetAssetId !== action.assetId) return [sid, sc]
          const { tilesetAssetId: _drop, ...rest } = sc.tilemap
          return [sid, { ...sc, tilemap: rest }]
        }),
      )
      return {
        ...state,
        project: { ...state.project, tilesets, scenes },
        projectDirty: true,
      }
    }
    case 'ASSET_ADD': {
      if (!state.project) return state
      return {
        ...state,
        project: {
          ...state.project,
          assets: {
            ...(state.project.assets ?? {}),
            [action.asset.id]: action.asset,
          },
        },
        projectDirty: true,
      }
    }
    case 'ASSET_REMOVE': {
      if (!state.project || !state.project.assets) return state
      const removed = state.project.assets[action.assetId]
      const assets = Object.fromEntries(
        Object.entries(state.project.assets).filter(
          ([k]) => k !== action.assetId,
        ),
      )
      // Detach the sprite from any entity that referenced this image so it
      // falls back cleanly instead of pointing at a missing asset.
      const entities = removed
        ? Object.fromEntries(
            Object.entries(state.project.entities).map(([eid, e]) =>
              e.sprite?.spriteAssetId === removed.path
                ? [eid, { ...e, sprite: { ...e.sprite, spriteAssetId: '' } }]
                : [eid, e],
            ),
          )
        : state.project.entities
      return {
        ...state,
        project: { ...state.project, assets, entities },
        projectDirty: true,
      }
    }
    case 'TILEMAP_SET_TILESETID': {
      const sc = state.project?.scenes[action.sceneId]
      if (!state.project || !sc) return state
      const tm = sc.tilemap ?? createTilemap(sc.worldSize.x, sc.worldSize.y)
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: {
              ...sc,
              tilemap: { ...tm, tilesetAssetId: action.assetId },
            },
          },
        },
        projectDirty: true,
      }
    }
    default:
      return state
  }
}
