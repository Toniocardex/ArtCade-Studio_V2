import { clearLogicCompileCache } from './logic-board/logic-compile-service'
import { clearProjectWorkbenchCache } from './project-health'
import { registerProjectFsScope } from './project-fs-scope'
import { clearPendingAssets } from './pending-asset-store'

/** Module caches that must not survive a LOAD_PROJECT dispatch. */
export function runLoadProjectSideEffects(projectJsonPath: string | null): void {
  clearLogicCompileCache()
  clearProjectWorkbenchCache()
  clearPendingAssets()
  void registerProjectFsScope(projectJsonPath)
}
