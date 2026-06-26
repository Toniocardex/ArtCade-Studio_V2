// ---------------------------------------------------------------------------
// Object type + scene instance placement (project format v2)
// ---------------------------------------------------------------------------

import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import {
  defaultEntitySpawnPosition,
  nextEntityId,
} from '../../utils/project'
import {
  materializeEntity,
  rematerializeAllInstancesOfType,
} from '../../utils/project-object-types'
import { gcUnusedGeneratedPrototypeAssets, syncGeneratedPrototypeAsset } from '../../utils/prototype-sprite'
import { assertPrototypeOwnership } from '../../utils/entity-retype'
import {
  createDefaultObjectType,
  objectTypeCreateBlocked,
} from '../../utils/object-create'
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

function activeLayerPlacement(state: CoreState): Pick<SceneInstanceDef, 'layerId'> {
  const layerId = state.editorActiveLayerId?.trim()
  return layerId ? { layerId } : {}
}

function objectTypeNameTaken(
  project: NonNullable<CoreState['project']>,
  displayName: string,
  exceptObjectTypeId?: string,
): boolean {
  return objectTypeCreateBlocked(project, displayName, exceptObjectTypeId) !== null
}

function syncInstanceTransform(
  sceneId: string,
  entityId: number,
  project: NonNullable<CoreState['project']>,
): SceneInstanceDef[] | undefined {
  const scene = project.scenes?.[sceneId]
  const inst = scene?.instances?.find((i) => i.id === entityId)
  const ent = project.entities?.[entityId]
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
      if (objectTypeNameTaken(state.project, displayName, action.objectTypeId)) return state
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
      const scenes = Object.fromEntries(Object.entries(state.project.scenes ?? {}).map(([sceneId, scene]) => [
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
      const scene = state.project?.scenes?.[action.sceneId]
      if (!state.project || !scene) return state
      const instances = scene.instances?.map((instance) =>
        instance.id === action.instanceId
          ? { ...instance, localVariableOverrides: action.overrides }
          : instance,
      )
      if (!instances) return state
      const entity = state.project.entities?.[action.instanceId]
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
      const inUse = Object.values(state.project.scenes ?? {}).some((sc) =>
        (sc.instances ?? []).some((i) => i.objectTypeId === action.objectTypeId),
      )
      if (inUse) return state
      const objectTypes = { ...state.project.objectTypes }
      delete objectTypes[action.objectTypeId]
      const project = gcUnusedGeneratedPrototypeAssets({
        ...state.project,
        objectTypes,
      })
      return {
        ...state,
        project,
        projectDirty: true,
      }
    }
    case 'OBJECT_CREATE': {
      if (!state.project) return state
      const project = state.project
      const typeId = action.objectType.id
      const instanceId = action.instance.id
      const scene = project.scenes?.[action.sceneId]
      if (!scene) return state
      if (objectTypeCreateBlocked(project, action.objectType.displayName)) return state
      if (project.entities?.[instanceId]) return state
      if (scene.instances?.some((i) => i.id === instanceId)) return state

      const syncedPrototype = syncGeneratedPrototypeAsset(action.prototypeAsset, typeId)
      const objectType = createDefaultObjectType({
        typeId,
        displayName: action.objectType.displayName,
        prototypeAsset: syncedPrototype,
      })
      const instance: SceneInstanceDef = {
        ...action.instance,
        ...activeLayerPlacement(state),
      }

      const nextProject = {
        ...project,
        assets: {
          ...(project.assets ?? {}),
          [syncedPrototype.id]: syncedPrototype,
        },
        objectTypes: {
          ...(project.objectTypes ?? {}),
          [typeId]: objectType,
        },
        scenes: {
          ...project.scenes,
          [action.sceneId]: {
            ...scene,
            instances: [...(scene.instances ?? []), instance],
            entityIds: [...(scene.entityIds ?? []), instanceId],
          },
        },
      }

      assertPrototypeOwnership(nextProject, typeId)

      const materialized = materializeEntity(objectType, instance)

      return {
        ...state,
        project: {
          ...nextProject,
          entities: {
            ...(project.entities ?? {}),
            [instanceId]: materialized,
          },
        },
        selection: {
          ...state.selection,
          entityId: instanceId,
          entityIds: [instanceId],
          sceneId: action.sceneId,
        },
        projectDirty: true,
      }
    }
    case 'OBJECT_TYPE_ADD': {
      if (!state.project) return state
      const { typeId, displayName, prototypeAsset } = action
      if (objectTypeCreateBlocked(state.project, displayName)) return state
      const syncedPrototype = syncGeneratedPrototypeAsset(prototypeAsset, typeId)
      const proto = createDefaultObjectType({
        typeId,
        displayName: displayName || typeId,
        prototypeAsset: syncedPrototype,
      })
      return {
        ...state,
        project: {
          ...state.project,
          objectTypes: { ...state.project.objectTypes, [typeId]: proto },
          assets: { ...(state.project.assets ?? {}), [syncedPrototype.id]: syncedPrototype },
        },
        projectDirty: true,
      }
    }
    case 'INSTANCE_ADD_FROM_TYPE': {
      const scene = state.project?.scenes?.[action.sceneId]
      if (!state.project || !scene) return state
      const type = state.project.objectTypes?.[action.objectTypeId]
      if (!type) return state
      const id = nextEntityId(state.project)
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
        ...activeLayerPlacement(state),
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
        selection: { ...state.selection, entityId: id, entityIds: [id] },
        projectDirty: true,
      }
    }
    case 'INSTANCE_DUPLICATE': {
      // Duplicate in scene = new instance of the SAME type (offset placement).
      // Never clones the EntityDef or infers a new type (Fase C contract).
      const scene = state.project?.scenes?.[action.sceneId]
      if (!state.project || !scene) return state
      const src = scene.instances?.find((i) => i.id === action.instanceId)
      const type = src ? state.project.objectTypes?.[src.objectTypeId] : undefined
      if (!src || !type) return state
      const id = nextEntityId(state.project)
      const srcName =
        src.instanceName ?? state.project.entities?.[src.id]?.name ?? type.displayName
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
        ...(src.layerId ? { layerId: src.layerId } : {}),
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
        selection: { ...state.selection, entityId: id, entityIds: [id] },
        projectDirty: true,
      }
    }
    case 'INSTANCE_COPY': {
      const scene = state.project?.scenes?.[action.sceneId]
      if (!state.project || !scene) return state
      const src = scene.instances?.find((i) => i.id === action.instanceId)
      if (!src) return state
      return {
        ...state,
        instanceClipboard: {
          sceneId: action.sceneId,
          instance: {
            ...src,
            transform: {
              position: { ...src.transform.position },
              scale: { ...src.transform.scale },
              rotation: src.transform.rotation,
              ...(src.transform.velocity
                ? { velocity: { ...src.transform.velocity } }
                : {}),
            },
            ...(src.localVariableOverrides
              ? { localVariableOverrides: { ...src.localVariableOverrides } }
              : {}),
          },
        },
      }
    }
    case 'INSTANCE_PASTE': {
      const scene = state.project?.scenes?.[action.sceneId]
      if (!state.project || !scene) return state
      const clip = state.instanceClipboard
      if (!clip || clip.sceneId !== action.sceneId) return state
      const type = state.project.objectTypes?.[clip.instance.objectTypeId]
      if (!type) return state
      const id = nextEntityId(state.project)
      const srcName =
        clip.instance.instanceName
        ?? state.project.entities?.[clip.instance.id]?.name
        ?? type.displayName
      const position = action.position &&
        Number.isFinite(action.position.x) && Number.isFinite(action.position.y)
        ? { ...action.position }
        : {
            x: clip.instance.transform.position.x + 16,
            y: clip.instance.transform.position.y + 16,
          }
      const pasted: SceneInstanceDef = {
        ...clip.instance,
        id,
        instanceName: nextInstanceName(state.project, srcName),
        transform: {
          position,
          scale: { ...clip.instance.transform.scale },
          rotation: clip.instance.transform.rotation,
          ...(clip.instance.transform.velocity
            ? { velocity: { ...clip.instance.transform.velocity } }
            : {}),
        },
        ...(clip.instance.localVariableOverrides
          ? { localVariableOverrides: { ...clip.instance.localVariableOverrides } }
          : {}),
      }
      const ent = materializeEntity(type, pasted)
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [id]: ent },
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: {
              ...scene,
              instances: [...(scene.instances ?? []), pasted],
              entityIds: [...scene.entityIds, id],
            },
          },
        },
        selection: { ...state.selection, entityId: id, entityIds: [id] },
        projectDirty: true,
      }
    }
    case 'UPDATE_ENTITY_TRANSFORM': {
      const entity = state.project?.entities?.[action.entityId]
      if (!state.project || !entity) return state
      const sceneId = state.selection.sceneId ?? state.project.activeSceneId
      const scene = state.project.scenes?.[sceneId]
      if (!scene) return state
      const instances = syncInstanceTransform(sceneId, action.entityId, state.project)
      if (!instances) return state
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: { ...scene, instances },
          },
        },
      }
    }
    default:
      return state
  }
}
