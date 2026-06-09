import { clearLogicCompileCache } from './logic-board/logic-compile-service'
import { clearProjectWorkbenchCache } from './project-health'

/** Module caches that must not survive a LOAD_PROJECT dispatch. */
export function runLoadProjectSideEffects(): void {
  clearLogicCompileCache()
  clearProjectWorkbenchCache()
}
