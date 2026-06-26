// ---------------------------------------------------------------------------
// object-type-delete — cascade removal of an object type and its dependents
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import { gcUnusedGeneratedPrototypeAssets } from './prototype-sprite'

export type DeleteObjectTypeCascadeResult = Readonly<{
  project: ProjectDoc
  deletedEntityIds: number[]
}>

/**
 * Removes an object type, every scene instance of that type, materialized entities,
 * type-scoped logic boards, and unreferenced generated prototype assets.
 */
export function deleteObjectTypeCascade(
  project: ProjectDoc,
  objectTypeId: string,
): DeleteObjectTypeCascadeResult {
  const type = project.objectTypes?.[objectTypeId]
  if (!type) {
    return { project, deletedEntityIds: [] }
  }

  const deletedEntityIds: number[] = []

  const scenes = Object.fromEntries(
    Object.entries(project.scenes ?? {}).map(([sceneId, scene]) => {
      const removedIds = new Set(
        (scene.instances ?? [])
          .filter((instance) => instance.objectTypeId === objectTypeId)
          .map((instance) => instance.id),
      )

      deletedEntityIds.push(...removedIds)

      return [
        sceneId,
        {
          ...scene,
          instances: (scene.instances ?? []).filter(
            (instance) => instance.objectTypeId !== objectTypeId,
          ),
          entityIds: scene.entityIds.filter((id) => !removedIds.has(id)),
        },
      ]
    }),
  )

  const deletedIds = new Set(deletedEntityIds)

  const entities = Object.fromEntries(
    Object.entries(project.entities ?? {}).filter(
      ([id]) => !deletedIds.has(Number(id)),
    ),
  )

  const objectTypes = { ...(project.objectTypes ?? {}) }
  delete objectTypes[objectTypeId]

  const logicBoards = (project.logicBoards ?? []).filter(
    (board) =>
      board.target.type !== 'object_type'
      || board.target.objectTypeId !== objectTypeId,
  )

  const cleaned = gcUnusedGeneratedPrototypeAssets({
    ...project,
    scenes,
    entities,
    objectTypes,
    logicBoards,
  })

  return {
    project: cleaned,
    deletedEntityIds,
  }
}
