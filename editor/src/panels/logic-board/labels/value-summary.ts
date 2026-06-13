import type { ProjectDoc } from '../../../types'
import type { LogicValue } from '../../../types/logic-board'
import { targetDisplayLabel } from './board-labels'

export function valueSummary(value: LogicValue, project?: ProjectDoc | null): string {
  if (typeof value !== 'object' || value === null) return String(value)
  switch (value.source) {
    case 'state':
      return `variable ${value.key || '?'}`
    case 'global':
      return `global ${value.key || '?'}`
    case 'local':
      return `${targetDisplayLabel(value.target, project)}.${value.key || '?'}`
    case 'message':
      return `message.${value.key || '?'}`
    case 'random':
      return `random ${value.min} to ${value.max}`
    case 'entity':
      return `${targetDisplayLabel(value.target, project)} ${value.property}`
    case 'component':
      return `${targetDisplayLabel(value.target, project)} ${value.property}`
    case 'expression': {
      const operatorLabels = {
        add: '+', subtract: '-', multiply: 'x', divide: '/', modulo: '%',
        min: 'min', max: 'max', power: '^',
      } as const
      return value.operations.reduce(
        (summary, operation) =>
          `(${summary} ${operatorLabels[operation.operator]} ${valueSummary(operation.value, project)})`,
        valueSummary(value.initial, project),
      )
    }
  }
}
