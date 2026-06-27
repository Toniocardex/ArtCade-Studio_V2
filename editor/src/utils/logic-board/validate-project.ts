import type { ProjectDoc } from '../../types'
import { assertProjectPathsSafe } from '../project-path-security'
import { assertProjectDiagnosticsClean } from '../project-validator'
import { assertLogicBoardsValid } from './schema-registry'

function pushValidationStep(out: string[], step: () => void): void {
  try {
    step()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    for (const line of message.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !out.includes(trimmed)) out.push(trimmed)
    }
  }
}

/** Non-throwing save/play gate with deduplicated error messages. */
export function collectSaveValidationErrors(project: ProjectDoc): string[] {
  const errors: string[] = []
  pushValidationStep(errors, () => assertProjectPathsSafe(project))
  pushValidationStep(errors, () => assertProjectDiagnosticsClean(project))
  pushValidationStep(errors, () => {
    if (Object.keys(project.scenes ?? {}).length === 0) {
      throw new Error('Project must contain at least one scene.')
    }
  })
  pushValidationStep(errors, () => {
    if (!project.scenes?.[project.activeSceneId]) {
      throw new Error(`Start scene "${project.activeSceneId}" does not exist.`)
    }
  })
  const types = project.objectTypes ?? {}
  for (const scene of Object.values(project.scenes ?? {})) {
    for (const inst of scene.instances ?? []) {
      pushValidationStep(errors, () => {
        if (!types[inst.objectTypeId]) {
          throw new Error(
            `Scene "${scene.name}": instance #${inst.id} references unknown object type "${inst.objectTypeId}".`,
          )
        }
      })
    }
  }
  for (const board of project.logicBoards ?? []) {
    const t = board.target
    pushValidationStep(errors, () => {
      if (t.type === 'object_type' && t.objectTypeId && !types[t.objectTypeId]) {
        throw new Error(
          `Logic board "${board.name}" targets unknown object type "${t.objectTypeId}".`,
        )
      }
    })
  }
  pushValidationStep(errors, () => assertLogicBoardsValid(project.logicBoards))
  return errors
}

export function validateProjectBeforeSave(project: ProjectDoc): void {
  const errors = collectSaveValidationErrors(project)
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }
}
