import type { LogicPrimitive, LogicValue, LogicValueSource } from '../../types/logic-board'
import { parseLogicNumber } from '../../utils/logic-board/parse-logic-number'
import { EditorSelect } from '../ui/EditorSelect'
import { TargetPicker } from './TargetPicker'

const inputClass =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'

type SourceKind = 'literal' | LogicValueSource['source']

const SOURCE_OPTIONS = [
  { value: 'literal', label: 'Literal' },
  { value: 'state', label: 'Variable' },
  { value: 'entity', label: 'Object property' },
  { value: 'message', label: 'Message field' },
  { value: 'random', label: 'Random integer' },
]

const ENTITY_PROPERTY_OPTIONS = [
  { value: 'positionX', label: 'Position X' },
  { value: 'positionY', label: 'Position Y' },
  { value: 'velocityX', label: 'Velocity X' },
  { value: 'velocityY', label: 'Velocity Y' },
  { value: 'speed', label: 'Speed' },
  { value: 'healthCurrent', label: 'Current health' },
  { value: 'healthMax', label: 'Maximum health' },
]

function sourceKind(value: LogicValue): SourceKind {
  return typeof value === 'object' && value !== null ? value.source : 'literal'
}

function literalFromInput(raw: string, numeric: boolean): LogicPrimitive {
  if (numeric) return parseLogicNumber(raw) ?? 0
  if (raw === 'true') return true
  if (raw === 'false') return false
  const parsed = parseLogicNumber(raw)
  return parsed ?? raw
}

function sourceDefault(kind: SourceKind, numeric: boolean): LogicValue {
  switch (kind) {
    case 'literal':
      return numeric ? 0 : ''
    case 'state':
      return { source: 'state', key: '', fallback: numeric ? 0 : '' }
    case 'message':
      return { source: 'message', key: '', fallback: numeric ? 0 : '' }
    case 'entity':
      return { source: 'entity', target: 'self', property: 'positionX' }
    case 'random':
      return { source: 'random', min: 0, max: 1 }
  }
}

export function ValueSourceField({
  value,
  numeric,
  onChange,
}: Readonly<{
  value: LogicValue | undefined
  numeric: boolean
  onChange: (value: LogicValue) => void
}>) {
  const current = value ?? (numeric ? 0 : '')
  const kind = sourceKind(current)

  return (
    <span className="flex items-center flex-wrap gap-1">
      <EditorSelect
        className="w-auto"
        triggerClassName="py-1"
        value={kind}
        onChange={(next) => onChange(sourceDefault(next as SourceKind, numeric))}
        options={SOURCE_OPTIONS}
        aria-label="Value source"
      />
      {kind === 'literal' && (
        <input
          className={`${inputClass} w-24`}
          type={numeric ? 'number' : 'text'}
          value={String(current)}
          onChange={(event) => onChange(literalFromInput(event.target.value, numeric))}
        />
      )}
      {kind === 'state' && typeof current === 'object' && current.source === 'state' && (
        <input
          className={`${inputClass} w-28`}
          placeholder="Variable key"
          value={current.key}
          onChange={(event) => onChange({ ...current, key: event.target.value })}
        />
      )}
      {kind === 'message' && typeof current === 'object' && current.source === 'message' && (
        <input
          className={`${inputClass} w-28`}
          placeholder="Payload key"
          value={current.key}
          onChange={(event) => onChange({ ...current, key: event.target.value })}
        />
      )}
      {kind === 'entity' && typeof current === 'object' && current.source === 'entity' && (
        <>
          <TargetPicker
            value={current.target}
            onChange={(target) => onChange({ ...current, target })}
          />
          <EditorSelect
            className="w-auto"
            triggerClassName="py-1"
            value={current.property}
            onChange={(property) =>
              onChange({ ...current, property: property as typeof current.property })
            }
            options={ENTITY_PROPERTY_OPTIONS}
            aria-label="Object property"
          />
        </>
      )}
      {kind === 'random' && typeof current === 'object' && current.source === 'random' && (
        <>
          <input
            className={`${inputClass} w-20`}
            type="number"
            aria-label="Minimum"
            value={current.min}
            onChange={(event) => onChange({ ...current, min: parseLogicNumber(event.target.value) ?? 0 })}
          />
          <span className="text-[10px] text-[var(--muted)]">to</span>
          <input
            className={`${inputClass} w-20`}
            type="number"
            aria-label="Maximum"
            value={current.max}
            onChange={(event) => onChange({ ...current, max: parseLogicNumber(event.target.value) ?? 0 })}
          />
        </>
      )}
    </span>
  )
}
