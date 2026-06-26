import type { ProjectDoc } from '../../types'
import { assertProjectPathsSafe } from '../project-path-security'
import { assertProjectDiagnosticsClean } from '../project-validator'
import { assertLogicBoardsValid } from './schema-registry'

export function validateProjectBeforeSave(project: ProjectDoc): void {
  assertProjectPathsSafe(project)
  assertProjectDiagnosticsClean(project)
  if (Object.keys(project.scenes ?? {}).length === 0) {
    throw new Error('Project must contain at least one scene.')
  }
  if (!project.scenes?.[project.activeSceneId]) {
    throw new Error(`Start scene "${project.activeSceneId}" does not exist.`)
  }
  const types = project.objectTypes ?? {}
  for (const scene of Object.values(project.scenes ?? {})) {
    for (const inst of scene.instances ?? []) {
      if (!types[inst.objectTypeId]) {
        throw new Error(
          `Scene "${scene.name}": instance #${inst.id} references unknown object type "${inst.objectTypeId}".`,
        )
      }
    }
  }
  for (const board of project.logicBoards ?? []) {
    const t = board.target
    if (t.type === 'object_type' && t.objectTypeId && !types[t.objectTypeId]) {
      throw new Error(
        `Logic board "${board.name}" targets unknown object type "${t.objectTypeId}".`,
      )
    }
  }
  assertLogicBoardsValid(project.logicBoards)
}
