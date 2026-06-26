// ---------------------------------------------------------------------------
// Incremental instance naming — "Coin" → "Coin_1", "Coin_2", … (Name + 1)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Base name with any trailing `_N` numeric suffix removed ("Coin_2" → "Coin"). */
export function instanceBaseName(name: string): string {
  return name.replace(/_\d+$/, '')
}

/**
 * Next free incremental name for an instance of `name`'s base family.
 * Scans entity names and scene instance names project-wide and returns
 * `<base>_<highest + 1>` (e.g. "Coin" with "Coin_3" present → "Coin_4").
 * @param project  loaded project document
 * @param name     source name (instance name, entity name, or type displayName)
 */
export function nextInstanceName(project: ProjectDoc, name: string): string {
  const base = instanceBaseName(name)
  const pattern = new RegExp(`^${escapeRegExp(base)}_(\\d+)$`)
  let highest = 0
  const consider = (candidate: string | undefined) => {
    if (!candidate) return
    const match = pattern.exec(candidate)
    if (match) highest = Math.max(highest, parseInt(match[1], 10))
  }
  for (const entity of Object.values(project.entities)) consider(entity.name)
  for (const scene of Object.values(project.scenes)) {
    for (const inst of scene.instances ?? []) consider(inst.instanceName)
  }
  return `${base}_${highest + 1}`
}

/**
 * Whether `name` is already used verbatim by an entity or scene instance.
 * Used to keep the very first instance of a type on the plain type name.
 */
export function isInstanceNameTaken(project: ProjectDoc, name: string): boolean {
  if (Object.values(project.entities).some((entity) => entity.name === name)) return true
  return Object.values(project.scenes).some((scene) =>
    (scene.instances ?? []).some((inst) => inst.instanceName === name),
  )
}

/** Whether `name` is already used by another scene instance's visible display name. */
export function isInstanceNameTakenInScene(
  project: ProjectDoc,
  sceneId: string,
  name: string,
  exceptEntityId?: number,
): boolean {
  const scene = project.scenes?.[sceneId]
  const wanted = name.trim().toLocaleLowerCase()
  if (!scene || !wanted) return false
  return (scene.instances ?? []).some((instance) => {
    if (exceptEntityId != null && instance.id === exceptEntityId) return false
    const entity = project.entities?.[instance.id]
    const type = project.objectTypes?.[instance.objectTypeId]
    const displayName = instance.instanceName ?? entity?.name ?? type?.displayName ?? ''
    return displayName.trim().toLocaleLowerCase() === wanted
  })
}
