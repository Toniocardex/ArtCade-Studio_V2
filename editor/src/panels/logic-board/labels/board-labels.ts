import type { ProjectDoc } from '../../../types'
import type { LogicBoard, TargetSelector } from '../../../types/logic-board'
import {
  classDisplayLabel,
  entityIdDisplayLabel,
  logicBoardLabel,
} from '../../../utils/project'

export function fmtClass(className: string, project?: ProjectDoc | null): string {
  return classDisplayLabel(project, className)
}

export function targetDisplayLabel(
  t: TargetSelector,
  project?: ProjectDoc | null,
): string {
  if (t === 'self') return 'This object'
  if (t === 'other') return 'Other object'
  if ('entityId' in t) return entityIdDisplayLabel(project, t.entityId)
  if ('className' in t) {
    const name = fmtClass(t.className, project)
    return t.first ? `First ${name}` : `Any ${name}`
  }
  return 'Target'
}

export function boardDisplayName(
  board: LogicBoard,
  project?: ProjectDoc | null,
): string {
  return logicBoardLabel(project, board)
}
