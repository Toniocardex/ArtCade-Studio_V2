// ---------------------------------------------------------------------------
// runtime-asset-sync — scene asset load entry (Phase B, shared by hook + service)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../../types'
import { assetOrchestrator } from '../../utils/asset-orchestrator'
import type { CollectSceneAssetRefsOptions } from '../../utils/collect-scene-asset-refs'
import { dirName } from '../../utils/project'

/** Load active scene textures, prefetch siblings (idle). */
export function performRuntimeSceneAssetSync(
  project: ProjectDoc,
  activeSceneId: string,
  projectPath: string | null,
  options?: Pick<CollectSceneAssetRefsOptions, 'scope'>,
): void {
  const root = projectPath ? dirName(projectPath) : ''
  void assetOrchestrator.loadScene(project, activeSceneId, root, options)
  // Prefetch inactive scenes with scene-static only — spawn prototypes apply to active scene.
  const prefetchOptions =
    options?.scope === 'scene+spawn-prototypes'
      ? { scope: 'scene-static' as const }
      : options
  for (const sid of Object.keys(project.scenes)) {
    if (sid !== activeSceneId) {
      assetOrchestrator.prefetchScene(project, sid, root, prefetchOptions)
    }
  }
}
