// ---------------------------------------------------------------------------
// Object type + scene instance placement (project format v2)
// ---------------------------------------------------------------------------

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import {
  createEntityDef,
  defaultEntitySpawnPosition,
  nextEntityId,
} from '../../utils/project'
import {
  entityToObjectType,
  materializeEntity,
  rematerializeAllInstancesOfType,
  slugTypeId,
} from '../../utils/project-object-types'
import {
  isInstanceNameTaken,
  nextInstanceName,
} from '../../utils/project-instance-names'
import type { GameVariableDefinition, GameVariableValue, SceneInstanceDef } from '../../types'

function cleanVariableOverrides(
  overrides: Record<string, GameVariableValue> | undefined,
  definitions: GameVariableDefinition[],
): Record<string, GameVariableValue> | undefined {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition.type]))
  const entries = Object.entries(overrides ?? {}).filter(([key, value]) => {
    const type = byKey.get(key)
    return (type === 'number' && typeof value === 'number')
      || (type === 'boolean' && typeof value === 'boolean')
      || (type === 'string' && typeof value === 'string')
  })
  return entries.length ? Object.fromEntries(entries) : undefined
}

function syncInstanceTransform(
  sceneId: string,
  entityId: number,
  project: NonNullable<CoreState['project']>,
): SceneInstanceDef[] | undefined {
  const scene = project.scenes[sceneId]
  const inst = scene?.instances?.find((i) => i.id === entityId)
  const ent = project.entities[entityId]
  if (!inst || !ent) return scene?.instances
  return scene.instances!.map((i) =>
    i.id === entityId
      ? {
          ...i,
          transform: {
            position: { ...ent.transform.position },
            scale: { ...ent.transform.scale },
            rotation: ent.transform.rotation,
            ...(ent.transform.velocity
              ? { velocity: { ...ent.transform.velocity } }
              : {}),
          },
          ...(ent.visible === false ? { visible: false } : { visible: true }),
        }
      : i,
  )
}

export const objectTypeReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'OBJECT_TYPE_RENAME': {
      if (!state.project?.objectTypes?.[action.objectTypeId]) return state
      const existing = state.project.objectTypes[action.objectTypeId]
      const displayName = action.displayName.trim()
      if (!displayName || displayName === existing.displayName) return state
      return {
        ...state,
        project: {
          ...state.project,
          objectTypes: {
            ...state.project.objectTypes,
            [action.objectTypeId]: { ...existing, displayName },
          },
        },
        projectDirty: true,
      }
    }
    case 'OBJECT_TYPE_VARIABLES_SET': {
      if (!state.project?.objectTypes?.[action.objectTypeId]) return state
      const type = state.project.objectTypes[action.objectTypeId]
      const scenes = Object.fromEntries(Object.entries(state.project.scenes).map(([sceneId, scene]) => [
        sceneId,
        {
          ...scene,
          instances: scene.instances?.map((instance) => instance.objectTypeId === action.objectTypeId
            ? { ...instance, localVariableOverrides: cleanVariableOverrides(instance.localVariableOverrides, action.variables) }
            : instance),
        },
      ]))
      const project = {
        ...state.project,
        scenes,
        objectTypes: {
          ...state.project.objectTypes,
          [action.objectTypeId]: { ...type, localVariables: action.variables },
        },
      }
      return {
        ...state,
        project: rematerializeAllInstancesOfType(project, action.objectTypeId),
        projectDirty: true,
      }
    }
    case 'INSTANCE_VARIABLE_OVERRIDES_SET': {
      if (!state.project?.scenes[action.sceneId]) return state
      const scene = state.project.scenes[action.sceneId]
      const instances = scene.instances?.map((instance) =>
        instance.id === action.instanceId
          ? { ...instance, localVariableOverrides: action.overrides }
          : instance,
      )
      if (!instances) return state
      const entity = state.project.entities[action.instanceId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: entity
            ? {
                ...state.project.entities,
                [action.instanceId]: { ...entity, localVariableOverrides: action.overrides },
              }
            : state.project.entities,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...scene, instances },
          },
        },
        projectDirty: true,
      }
    }
    case 'OBJECT_TYPE_DELETE': {
      if (!state.project?.objectTypes?.[action.objectTypeId]) return state
      const inUse = Object.values(state.project.scenes).some((sc) =>
        (sc.instances ?? []).some((i) => i.objectTypeId === action.objectTypeId),
      )
      if (inUse) return state
      const objectTypes = { ...state.project.objectTypes }
      delete objectTypes[action.objectTypeId]
      return {
        ...state,
        project: { ...state.project, objectTypes },
        projectDirty: true,
      }
    }
    case 'OBJECT_TYPE_ADD': {
      if (!state.project) return state
      const typeId = slugTypeId(action.displayName || 'Object')
      if (state.project.objectTypes?.[typeId]) return state
      const proto = entityToObjectType(
        createEntityDef(0, action.displayName || typeId, typeId),
        typeId,
      )
      return {
        ...state,
        project: {
          ...state.project,
          objectTypes: { ...state.project.objectTypes, [typeId]: proto },
        },
        projectDirty: true,
      }
    }
    case 'INSTANCE_ADD_FROM_TYPE': {
      if (!state.project || !state.project.scenes[action.sceneId]) return state
      const type = state.project.objectTypes?.[action.objectTypeId]
      if (!type) return state
      const id = nextEntityId(state.project)
      const scene = state.project.scenes[action.sceneId]
      const spawn = defaultEntitySpawnPosition(scene, state.editorGridSize, state.snapToGrid)
      // First instance keeps the plain type name; later ones get Name_N.
      const inst: SceneInstanceDef = {
        id,
        objectTypeId: action.objectTypeId,
        ...(isInstanceNameTaken(state.project, type.displayName)
          ? { instanceName: nextInstanceName(state.project, type.displayName) }
          : {}),
        transform: {
          position: spawn,
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
      }
      const ent = materializeEntity(type, inst)
      const instances = [...(scene.instances ?? []), inst]
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [id]: ent },
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: {
              ...scene,
              instances,
              entityIds: [...scene.entityIds, id],
            },
          },
        },
        selection: { ...state.selection, entityId: id },
        projectDirty: true,
      }
    }
    case 'INSTANCE_DUPLICATE': {
      // Duplicate in scene = new instance of the SAME type (offset placement).
      // Never clones the EntityDef or infers a new type (Fase C contract).
      if (!state.project || !state.project.scenes[action.sceneId]) return state
      const scene = state.project.scenes[action.sceneId]
      const src = scene.instances?.find((i) => i.id === action.instanceId)
      const type = src ? state.project.objectTypes?.[src.objectTypeId] : undefined
      if (!src || !type) return state
      const id = nextEntityId(state.project)
      const srcName =
        src.instanceName ?? state.project.entities[src.id]?.name ?? type.displayName
      const position = action.position &&
        Number.isFinite(action.position.x) && Number.isFinite(action.position.y)
        ? { ...action.position }
        : {
            x: src.transform.position.x + 16,
            y: src.transform.position.y + 16,
          }
      const copy: SceneInstanceDef = {
        id,
        objectTypeId: src.objectTypeId,
        instanceName: nextInstanceName(state.project, srcName),
        transform: {
          position,
          scale: { ...src.transform.scale },
          rotation: src.transform.rotation,
          ...(src.transform.velocity
            ? { velocity: { ...src.transform.velocity } }
            : {}),
        },
        ...(src.visible === false ? { visible: false } : {}),
      }
      const ent = materializeEntity(type, copy)
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [id]: ent },
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: {
              ...scene,
              instances: [...(scene.instances ?? []), copy],
              entityIds: [...scene.entityIds, id],
            },
          },
        },
        selection: { ...state.selection, entityId: id },
        projectDirty: true,
      }
    }
    case 'UPDATE_ENTITY_TRANSFORM': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const sceneId = state.selection.sceneId ?? state.project.activeSceneId
      const instances = syncInstanceTransform(sceneId, action.entityId, state.project)
      if (!instances) return state
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: { ...state.project.scenes[sceneId], instances },
          },
        },
      }
    }
    default:
      return state
  }
}
