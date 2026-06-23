import type { ProjectDoc } from '../types'
import { clearLogicCompileCache } from './logic-board/logic-compile-service'
import { clearProjectWorkbenchCache } from './project-health'
import { registerProjectFsScope } from './project-fs-scope'
import { clearPendingAssets, retainPendingAssets } from './pending-asset-store'
import { referencedAssetPaths } from './referenced-asset-paths'

/** Module caches that must not survive a LOAD_PROJECT dispatch. */
export function runLoadProjectSideEffects(
  projectJsonPath: string | null,
  project?: ProjectDoc | null,
): void {
  clearLogicCompileCache()
  clearProjectWorkbenchCache()
  // Keep staged bytes the loaded project still references (they may not be on
  // disk yet); drop the rest. With no project context, fall back to a full clear.
  if (project) retainPendingAssets(referencedAssetPaths(project))
  else clearPendingAssets()
  void registerProjectFsScope(projectJsonPath)
}
