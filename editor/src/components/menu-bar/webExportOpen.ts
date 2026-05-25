import type { WebExportState } from '../../utils/api'
import { dirName } from '../../utils/project'

export type OpenWebExportPlan =
  | { kind: 'skip' }
  | { kind: 'open'; projectRoot: string }

/** OPEN IN BROWSER uses the last BUILD WEB export on disk — no save/migrate dialog. */
export function planOpenWebExport(
  projectPath: string | null,
  exportState: WebExportState,
): OpenWebExportPlan {
  if (!projectPath || exportState !== 'ready') {
    return { kind: 'skip' }
  }
  return { kind: 'open', projectRoot: dirName(projectPath) }
}
