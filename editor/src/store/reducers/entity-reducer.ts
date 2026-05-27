// ---------------------------------------------------------------------------
// reducers/entity-reducer — every entity-level mutation
// ---------------------------------------------------------------------------
//
// Transform updates use a sub-pixel equality guard: the C++ runtime echoes
// a transform on every mouse-up even when the user did not actually drag,
// and treating those echoes as mutations would mark the project dirty for
// nothing (P2 in docs/TECHNICAL_DEBT_REVIEW.md).

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import { createEntityDef, nextEntityId, defaultEntitySpawnPosition } from '../../utils/project'

const TRANSFORM_EPS = 1e-4

export const entityReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'UPDATE_ENTITY_TRANSFORM': {
      if (state.isPlaying) return state
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      const t = entity.transform
      const unchanged =
        Math.abs(t.position.x - action.x)      < TRANSFORM_EPS &&
        Math.abs(t.position.y - action.y)      < TRANSFORM_EPS &&
        Math.abs(t.rotation   - action.rotation) < TRANSFORM_EPS &&
        Math.abs(t.scale.x    - action.scaleX) < TRANSFORM_EPS &&
        Math.abs(t.scale.y    - action.scaleY) < TRANSFORM_EPS
      if (unchanged) return state
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: {
              ...entity,
              transform: {
                ...entity.transform,
                position: { x: action.x, y: action.y },
                rotation: action.rotation,
                scale:    { x: action.scaleX, y: action.scaleY },
              },
            },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_SPRITE': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...entity, sprite: action.sprite },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_SPRITE_FILL': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: {
              ...entity,
              sprite: { ...entity.sprite, fillColor: action.fillColor },
            },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_PHYSICS': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...entity, physics: action.physics },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_REMOVE_PHYSICS': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      const { physics: _removed, ...rest } = entity
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [action.entityId]: rest },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_COMPONENT': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...entity, [action.key]: action.value },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_REMOVE_COMPONENT': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      const rest = Object.fromEntries(
        Object.entries(entity).filter(([k]) => k !== action.key),
      ) as typeof entity
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [action.entityId]: rest },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_ADD': {
      if (!state.project || !state.project.scenes[action.sceneId]) return state
      const id = nextEntityId(state.project)
      const scene = state.project.scenes[action.sceneId]
      const spawn = defaultEntitySpawnPosition(scene, state.editorGridSize, state.snapToGrid)
      const ent = createEntityDef(id, undefined, undefined, spawn)
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [id]: ent },
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...scene, entityIds: [...scene.entityIds, id] },
          },
        },
        selection: { ...state.selection, entityId: id },
        projectDirty: true,
      }
    }
    case 'ENTITY_DUPLICATE': {
      if (
        !state.project ||
        !state.project.entities[action.entityId] ||
        !state.project.scenes[action.sceneId]
      )
        return state
      const src = state.project.entities[action.entityId]
      const id = nextEntityId(state.project)
      // Plain JSON-serializable EntityDef -> deep clone is safe.
      const clone: typeof src = JSON.parse(JSON.stringify(src))
      clone.id   = id
      clone.name = `${src.name}_Copy`
      clone.transform = {
        ...clone.transform,
        position: {
          x: clone.transform.position.x + 16,
          y: clone.transform.position.y + 16,
        },
      }
      const scene = state.project.scenes[action.sceneId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [id]: clone },
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...scene, entityIds: [...scene.entityIds, id] },
          },
        },
        selection: { ...state.selection, entityId: id },
        projectDirty: true,
      }
    }
    case 'ENTITY_DELETE': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entities = Object.fromEntries(
        Object.entries(state.project.entities).filter(
          ([k]) => Number(k) !== action.entityId,
        ),
      )
      const scenes = Object.fromEntries(
        Object.entries(state.project.scenes).map(([sid, sc]) => [
          sid,
          { ...sc, entityIds: sc.entityIds.filter((i) => i !== action.entityId) },
        ]),
      )
      const logicBoards = (state.project.logicBoards ?? []).filter(
        (b) =>
          !(
            b.target.type === 'entity_id' &&
            b.target.entityId === action.entityId
          ),
      )
      return {
        ...state,
        project: {
          ...state.project,
          entities,
          scenes,
          ...(state.project.logicBoards != null
            ? { logicBoards: logicBoards.length > 0 ? logicBoards : undefined }
            : {}),
        },
        selection: {
          ...state.selection,
          entityId:
            state.selection.entityId === action.entityId
              ? null
              : state.selection.entityId,
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_VISIBLE': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const e = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...e, visible: action.visible },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_NAME': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const e = state.project.entities[action.entityId]
      const name = action.name.trim()
      if (!name || name === e.name) return state
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...e, name },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_CLASSNAME': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const e = state.project.entities[action.entityId]
      const className = action.className.trim()
      if (!className || className === e.className) return state
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...e, className },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_ADD_TAG': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const tag = action.tag.trim()
      if (!tag) return state
      const e = state.project.entities[action.entityId]
      if (e.tags.includes(tag)) return state
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...e, tags: [...e.tags, tag] },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_REMOVE_TAG': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const e = state.project.entities[action.entityId]
      if (!e.tags.includes(action.tag)) return state
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: {
              ...e,
              tags: e.tags.filter((t) => t !== action.tag),
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
