import { clearLogicCompileCache } from './logic-board/logic-compile-service'
import { clearProjectWorkbenchCache } from './project-health'
import { registerProjectFsScope } from './project-fs-scope'

/** Module caches that must not survive a LOAD_PROJECT dispatch. */
export function runLoadProjectSideEffects(projectJsonPath: string | null): void {
  clearLogicCompileCache()
  clearProjectWorkbenchCache()
  void registerProjectFsScope(projectJsonPath)
}
