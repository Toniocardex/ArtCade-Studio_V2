import type { ProjectDoc } from '../../types'
import { assertLogicBoardsValid } from './schema-registry'

export function validateProjectBeforeSave(project: ProjectDoc): void {
  assertLogicBoardsValid(project.logicBoards)
}
