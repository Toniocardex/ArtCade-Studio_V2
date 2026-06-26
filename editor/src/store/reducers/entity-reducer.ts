// ---------------------------------------------------------------------------
// reducers/entity-reducer — every entity-level mutation
// ---------------------------------------------------------------------------
//
// Object-model contract (docs/OBJECT_MODEL_MIGRATION.md, Fase C):
//   • Shared gameplay data (sprite, physics, components, tags, className)
//     lives on the OBJECT TYPE — editing it re-materializes every instance.
//   • Placement-only data (transform, instanceName, visible) lives on the
//     SCENE INSTANCE.
//   • `project.entities` is a derived cache (materializeEntity), never the
//     authoring source. No buildObjectModelFromEntities in the edit loop.
//
// Transform updates use a sub-pixel equality guard: the C++ runtime echoes
// a transform on every mouse-up even when the user did not actually drag,
// and treating those echoes as mutations would mark the project dirty for
// nothing (P2 in docs/TECHNICAL_DEBT_REVIEW.md).

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { ObjectTypeDef, ProjectDoc, SceneInstanceDef } from '../../types'
import {
  findSceneInstance,
  rematerializeAllInstancesOfType,
  rematerializeInstance,
} from '../../utils/project-object-types'
import { isInstanceNameTakenInScene } from '../../utils/project-instance-names'
import { assertPrototypeOwnership } from '../../utils/entity-retype'

const TRANSFORM_EPS = 1e-4

/**
 * Apply a patch to the object type that owns `entityId`'s instance, then
 * refresh the cache of every instance sharing that type. Returns null when
 * the instance has no resolvable type (cache-only legacy entity) so the
 * caller can fall back to a plain cache write.
 */
function patchTypeForInstance(
  project: ProjectDoc,
  entityId: number,
  patch: (type: ObjectTypeDef) => ObjectTypeDef,
): ProjectDoc | null {
  const found = findSceneInstance(project, entityId)
  if (!found) return null
  const typeId = found.instance.objectTypeId
  const type = project.objectTypes?.[typeId]
  if (!type) return null
  const next: ProjectDoc = {
    ...project,
    objectTypes: { ...project.objectTypes, [typeId]: patch(type) },
  }
  return rematerializeAllInstancesOfType(next, typeId)
}

/** Patch placement-only fields on the instance, then refresh its cache entry. */
function patchInstance(
  project: ProjectDoc,
  entityId: number,
  patch: (instance: SceneInstanceDef) => SceneInstanceDef,
): ProjectDoc | null {
  const found = findSceneInstance(project, entityId)
  if (!found) return null
  const scene = project.scenes?.[found.sceneId]
  if (!scene?.instances) return null
  const next: ProjectDoc = {
    ...project,
    scenes: {
      ...project.scenes,
      [found.sceneId]: {
        ...scene,
        instances: scene.instances.map((i) =>
          i.id === entityId ? patch(i) : i,
        ),
      },
    },
  }
  return rematerializeInstance(next, entityId)
}

/** Wrap a successful project mutation into the next CoreState. */
function withProject(state: CoreState, project: ProjectDoc): CoreState {
  return { ...state, project, projectDirty: true }
}

export const entityReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'UPDATE_ENTITY_TRANSFORM': {
      if (state.isPlaying) return state
      const entity = state.project?.entities?.[action.entityId]
      if (state.isPlaying || !state.project || !entity) return state
      const t = entity.transform
      const unchanged =
        Math.abs(t.position.x - action.x)      < TRANSFORM_EPS &&
        Math.abs(t.position.y - action.y)      < TRANSFORM_EPS &&
        Math.abs(t.rotation   - action.rotation) < TRANSFORM_EPS &&
        Math.abs(t.scale.x    - action.scaleX) < TRANSFORM_EPS &&
        Math.abs(t.scale.y    - action.scaleY) < TRANSFORM_EPS
      if (unchanged) return state
      // Cache write only — object-type-reducer mirrors the transform onto the
      // scene instance for the same action (instance stays authoritative).
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
      const entity = state.project?.entities?.[action.entityId]
      if (!state.project || !entity) return state
      const viaType = patchTypeForInstance(state.project, action.entityId, (type) => ({
        ...type,
        sprite: action.sprite,
      }))
      if (viaType) return withProject(state, viaType)
      return withProject(state, {
        ...state.project,
        entities: {
          ...state.project.entities,
          [action.entityId]: { ...entity, sprite: action.sprite },
        },
      })
    }
    case 'ENTITY_SET_SPRITE_FILL': {
      const entity = state.project?.entities?.[action.entityId]
      if (!state.project || !entity) return state
      const viaType = patchTypeForInstance(state.project, action.entityId, (type) => ({
        ...type,
        sprite: { ...type.sprite, fillColor: action.fillColor },
      }))
      if (viaType) return withProject(state, viaType)
      return withProject(state, {
        ...state.project,
        entities: {
          ...state.project.entities,
          [action.entityId]: {
            ...entity,
            sprite: { ...entity.sprite, fillColor: action.fillColor },
          },
        },
      })
    }
    case 'ENTITY_SET_PHYSICS': {
      const entity = state.project?.entities?.[action.entityId]
      if (!state.project || !entity) return state
      const viaType = patchTypeForInstance(state.project, action.entityId, (type) => ({
        ...type,
        physics: action.physics,
      }))
      if (viaType) return withProject(state, viaType)
      return withProject(state, {
        ...state.project,
        entities: {
          ...state.project.entities,
          [action.entityId]: { ...entity, physics: action.physics },
        },
      })
    }
    case 'ENTITY_REMOVE_PHYSICS': {
      const entity = state.project?.entities?.[action.entityId]
      if (!state.project || !entity) return state
      const viaType = patchTypeForInstance(state.project, action.entityId, (type) => {
        const { physics: _removed, ...rest } = type
        return rest
      })
      if (viaType) return withProject(state, viaType)
      const { physics: _removed, ...rest } = entity
      return withProject(state, {
        ...state.project,
        entities: { ...state.project.entities, [action.entityId]: rest },
      })
    }
    case 'ENTITY_SET_COMPONENT': {
      const entity = state.project?.entities?.[action.entityId]
      if (!state.project || !entity) return state
      const viaType = patchTypeForInstance(state.project, action.entityId, (type) => ({
        ...type,
        [action.key]: action.value,
      }))
      if (viaType) return withProject(state, viaType)
      return withProject(state, {
        ...state.project,
        entities: {
          ...state.project.entities,
          [action.entityId]: { ...entity, [action.key]: action.value },
        },
      })
    }
    case 'ENTITY_REMOVE_COMPONENT': {
      const entity = state.project?.entities?.[action.entityId]
      if (!state.project || !entity) return state
      const viaType = patchTypeForInstance(state.project, action.entityId, (type) =>
        Object.fromEntries(
          Object.entries(type).filter(([k]) => k !== action.key),
        ) as unknown as ObjectTypeDef,
      )
      if (viaType) return withProject(state, viaType)
      const rest = Object.fromEntries(
        Object.entries(entity).filter(([k]) => k !== action.key),
      ) as typeof entity
      return withProject(state, {
        ...state.project,
        entities: { ...state.project.entities, [action.entityId]: rest },
      })
    }
    case 'ENTITY_DELETE':
    case 'ENTITY_DELETE_MANY': {
      if (!state.project) return state
      const deleteIds = new Set(
        (action.type === 'ENTITY_DELETE'
          ? [action.entityId]
          : action.entityIds
        ).filter((id) => state.project?.entities?.[id]),
      )
      if (deleteIds.size === 0) return state
      const entities = Object.fromEntries(
        Object.entries(state.project.entities).filter(
          ([k]) => !deleteIds.has(Number(k)),
        ),
      )
      const scenes = Object.fromEntries(
        Object.entries(state.project.scenes ?? {}).map(([sid, sc]) => [
          sid,
          {
            ...sc,
            entityIds: sc.entityIds.filter((i) => !deleteIds.has(i)),
            ...(sc.instances
              ? { instances: sc.instances.filter((i) => !deleteIds.has(i.id)) }
              : {}),
          },
        ]),
      )
      // Boards and the object type survive: behavior lives on the type, and
      // the type stays in the catalog even with zero instances in scene.
      const entityIds = (state.selection.entityIds ?? []).filter((id) => !deleteIds.has(id))
      return {
        ...state,
        project: { ...state.project, entities, scenes },
        selection: {
          ...state.selection,
          entityId:
            state.selection.entityId != null && deleteIds.has(state.selection.entityId)
              ? (entityIds.length > 0 ? entityIds[entityIds.length - 1] : null)
              : state.selection.entityId,
          entityIds,
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_VISIBLE': {
      const e = state.project?.entities?.[action.entityId]
      if (!state.project || !e) return state
      const viaInstance = patchInstance(state.project, action.entityId, (inst) => ({
        ...inst,
        visible: action.visible,
      }))
      if (viaInstance) return withProject(state, viaInstance)
      return withProject(state, {
        ...state.project,
        entities: {
          ...state.project.entities,
          [action.entityId]: { ...e, visible: action.visible },
        },
      })
    }
    case 'ENTITY_SET_NAME': {
      const e = state.project?.entities?.[action.entityId]
      if (!state.project || !e) return state
      const name = action.name.trim()
      if (!name || name === e.name) return state
      const sceneId = state.selection.sceneId ?? state.project.activeSceneId
      if (isInstanceNameTakenInScene(state.project, sceneId, name, action.entityId)) return state
      const viaInstance = patchInstance(state.project, action.entityId, (inst) => ({
        ...inst,
        instanceName: name,
      }))
      if (viaInstance) return withProject(state, viaInstance)
      return withProject(state, {
        ...state.project,
        entities: {
          ...state.project.entities,
          [action.entityId]: { ...e, name },
        },
      })
    }
    case 'ENTITY_RETYPE': {
      if (!state.project) return state
      let project: ProjectDoc = state.project
      if (action.prototypeAsset) {
        project = {
          ...project,
          assets: {
            ...(project.assets ?? {}),
            [action.prototypeAsset.id]: action.prototypeAsset,
          },
        }
      }
      if (action.newObjectType) {
        project = {
          ...project,
          objectTypes: {
            ...(project.objectTypes ?? {}),
            [action.targetTypeId]: action.newObjectType,
          },
        }
        assertPrototypeOwnership(project, action.targetTypeId)
      }
      const retargeted = patchInstance(project, action.entityId, (inst) => ({
        ...inst,
        objectTypeId: action.targetTypeId,
      }))
      return retargeted ? withProject(state, retargeted) : state
    }
    case 'ENTITY_ADD_TAG': {
      const e = state.project?.entities?.[action.entityId]
      if (!state.project || !e) return state
      const tag = action.tag.trim()
      if (!tag) return state
      if (e.tags.includes(tag)) return state
      const viaType = patchTypeForInstance(state.project, action.entityId, (type) =>
        type.tags.includes(tag) ? type : { ...type, tags: [...type.tags, tag] },
      )
      if (viaType) return withProject(state, viaType)
      return withProject(state, {
        ...state.project,
        entities: {
          ...state.project.entities,
          [action.entityId]: { ...e, tags: [...e.tags, tag] },
        },
      })
    }
    case 'ENTITY_REMOVE_TAG': {
      const e = state.project?.entities?.[action.entityId]
      if (!state.project || !e) return state
      if (!e.tags.includes(action.tag)) return state
      const viaType = patchTypeForInstance(state.project, action.entityId, (type) => ({
        ...type,
        tags: type.tags.filter((t) => t !== action.tag),
      }))
      if (viaType) return withProject(state, viaType)
      return withProject(state, {
        ...state.project,
        entities: {
          ...state.project.entities,
          [action.entityId]: {
            ...e,
            tags: e.tags.filter((t) => t !== action.tag),
          },
        },
      })
    }
    default:
      return state
  }
}
