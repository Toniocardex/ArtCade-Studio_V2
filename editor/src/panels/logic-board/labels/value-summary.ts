import type { ProjectDoc } from '../../../types'
import type { LogicValue } from '../../../types/logic-board'
import { targetDisplayLabel } from './board-labels'

export function valueSummary(value: LogicValue, project?: ProjectDoc | null): string {
  if (typeof value !== 'object' || value === null) return String(value)
  switch (value.source) {
    case 'state':
      return `variable ${value.key || '?'}`
    case 'message':
      return `message.${value.key || '?'}`
    case 'random':
      return `random ${value.min} to ${value.max}`
    case 'entity':
      return `${targetDisplayLabel(value.target, project)} ${value.property}`
  }
}
