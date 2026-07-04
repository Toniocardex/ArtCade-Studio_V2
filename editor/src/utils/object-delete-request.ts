// ---------------------------------------------------------------------------
// object-delete-request — UI orchestration for instance vs object-type delete
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import { confirmDialog } from './native-dialog'
import {
  countObjectTypeInstances,
  countScenesWithObjectTypeInstances,
} from './object-type-usage'

export type DeleteObjectTarget =
  | { kind: 'instance'; entityId: number }
  | { kind: 'object-type'; objectTypeId: string }

function objectTypeDeleteMessage(
  instanceCount: number,
  sceneCount: number,
): string {
  if (instanceCount === 0) {
    return [
      'This will permanently remove the object type,',
      'its Logic Board and generated prototype.',
    ].join('\n')
  }

  const instanceLabel = `${instanceCount} instance${instanceCount === 1 ? '' : 's'}`
  const sceneLabel = `${sceneCount} scene${sceneCount === 1 ? '' : 's'}`

  return [
    `This object is used by ${instanceLabel} across ${sceneLabel}.`,
    '',
    `Deleting it will permanently remove:`,
    `• all ${instanceCount} instance${instanceCount === 1 ? '' : 's'}`,
    '• the object type',
    '• its components and variables',
    '• its Logic Board',
    '• its generated prototype',
  ].join('\n')
}

/**
 * Confirm and dispatch exactly one domain delete action.
 * Instance delete keeps the object type; object delete cascades through all scenes.
 */
export async function requestDeleteObject(options: {
  project: ProjectDoc | null
  target: DeleteObjectTarget
  deleteInstance: (entityId: number) => void
  deleteObjectType: (objectTypeId: string) => void
}): Promise<void> {
  const { deleteInstance, deleteObjectType, project, target } = options
  if (!project) return

  if (target.kind === 'instance') {
    const entity = project.entities?.[target.entityId]
    if (!entity) return

    const confirmed = await confirmDialog(
      `Remove "${entity.name}" from this scene?\n\nThe object type and its Logic Board are kept.`,
      { title: 'Delete instance', kind: 'warning' },
    )
    if (!confirmed) return

    deleteInstance(target.entityId)
    return
  }

  const type = project.objectTypes?.[target.objectTypeId]
  if (!type) return

  const instanceCount = countObjectTypeInstances(project, target.objectTypeId)
  const sceneCount = countScenesWithObjectTypeInstances(project, target.objectTypeId)

  const confirmed = await confirmDialog(
    objectTypeDeleteMessage(instanceCount, sceneCount),
    {
      title: `Delete object "${type.displayName}"?`,
      kind: 'warning',
    },
  )
  if (!confirmed) return

  deleteObjectType(target.objectTypeId)
}
