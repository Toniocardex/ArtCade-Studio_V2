import type { ProjectDoc } from '../../types'
import { isEntityInScene } from '../../utils/project'

/** Resolves whether the global entity selection applies to the current scene. */
export function resolveEffectiveEntitySelection(
  project: ProjectDoc | null | undefined,
  sceneId: string,
  entityId: number | null,
): Readonly<{ effectiveEntityId: number | null; inScene: boolean }> {
  if (!project || entityId == null || !sceneId) {
    return { effectiveEntityId: null, inScene: false }
  }
  const inScene = isEntityInScene(project, sceneId, entityId)
  return {
    effectiveEntityId: inScene ? entityId : null,
    inScene,
  }
}
