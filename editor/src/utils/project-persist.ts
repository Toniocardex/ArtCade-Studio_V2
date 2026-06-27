/**
 * Shared project persist contract: validate in memory, serialize, validate round-trip.
 */

import type { ProjectDoc } from '../types'
import { serializeProjectDoc } from './project-codec'
import { validateProjectBeforeSave, collectSaveValidationErrors } from './logic-board/validate-project'
import { loadProjectDocument, validateSerializedProjectDocument } from './project-document'

/** Non-throwing save/play gate used by health checks and UI. */
export { collectSaveValidationErrors } from './logic-board/validate-project'

/**
 * Validate a project and its serialized JSON before any disk write.
 * @returns serialized JSON ready for `write_file`
 */
export function prepareSerializedProjectDocument(project: ProjectDoc): string {
  validateProjectBeforeSave(project)
  const serialized = serializeProjectDoc(project)
  validateSerializedProjectDocument(serialized)
  return serialized
}

/** True when JSON text passes the full load pipeline (migrations + schema). */
export function isProjectJsonReadable(jsonStr: string): boolean {
  try {
    loadProjectDocument(jsonStr)
    return true
  } catch {
    return false
  }
}
