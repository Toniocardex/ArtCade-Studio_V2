import type { ObjectTypeDef, ProjectDoc } from '../types'

/**
 * Count scene instances referencing an object type across the whole project.
 */
export function countObjectTypeInstances(
  project: ProjectDoc,
  objectTypeId: string,
): number {
  return Object.values(project.scenes ?? {}).reduce(
    (count, scene) =>
      count + (scene.instances ?? []).filter(
        (instance) => instance.objectTypeId === objectTypeId,
      ).length,
    0,
  )
}

/** @deprecated Use countObjectTypeInstances */
export const objectTypeUsageCount = countObjectTypeInstances

/** Instances of a type placed in one scene. */
export function objectTypeInstanceCountInScene(
  project: ProjectDoc,
  sceneId: string,
  objectTypeId: string,
): number {
  return (project.scenes?.[sceneId]?.instances ?? []).filter(
    (instance) => instance.objectTypeId === objectTypeId,
  ).length
}

/** Scenes that contain at least one instance of the object type. */
export function countScenesWithObjectTypeInstances(
  project: ProjectDoc,
  objectTypeId: string,
): number {
  return Object.values(project.scenes ?? {}).filter((scene) =>
    (scene.instances ?? []).some((instance) => instance.objectTypeId === objectTypeId),
  ).length
}

/** Resolve a catalog type by its display name (case-insensitive). */
export function findObjectTypeByDisplayName(
  project: ProjectDoc,
  displayName: string,
): ObjectTypeDef | undefined {
  const wanted = displayName.trim().toLocaleLowerCase()
  return Object.values(project.objectTypes ?? {}).find(
    (type) => type.displayName.trim().toLocaleLowerCase() === wanted,
  )
}
