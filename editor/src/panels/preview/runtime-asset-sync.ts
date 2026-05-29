// ---------------------------------------------------------------------------
// runtime-asset-sync — scene asset load entry (Phase B, shared by hook + service)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../../types'
import { assetOrchestrator } from '../../utils/asset-orchestrator'
import { dirName } from '../../utils/project'

/** Load active scene textures, prefetch siblings (idle). */
export function performRuntimeSceneAssetSync(
  project: ProjectDoc,
  activeSceneId: string,
  projectPath: string | null,
): void {
  const root = projectPath ? dirName(projectPath) : ''
  void assetOrchestrator.loadScene(project, activeSceneId, root)
  for (const sid of Object.keys(project.scenes)) {
    if (sid !== activeSceneId) assetOrchestrator.prefetchScene(project, sid, root)
  }
}
