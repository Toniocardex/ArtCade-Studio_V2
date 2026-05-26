import type { ProjectDoc } from '../../types'
import { assertProjectPathsSafe } from '../project-path-security'
import { assertLogicBoardsValid } from './schema-registry'

export function validateProjectBeforeSave(project: ProjectDoc): void {
  assertProjectPathsSafe(project)
  if (Object.keys(project.scenes).length === 0) {
    throw new Error('Project must contain at least one scene.')
  }
  if (!project.scenes[project.activeSceneId]) {
    throw new Error(`Start scene "${project.activeSceneId}" does not exist.`)
  }
  assertLogicBoardsValid(project.logicBoards)
}
