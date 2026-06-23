import type {
  LogicPrimitive,
  LogicValue,
  LogicValueAtom,
  LogicValueSource,
} from '../../types/logic-board'
import { parseLogicNumber } from '../../utils/logic-board/parse-logic-number'
import { EditorSelect } from '../ui/EditorSelect'
import { TargetPicker } from './TargetPicker'
import { VariableKeyPicker } from './VariableKeyPicker'
import {
  COMPONENT_PROPERTY_OPTIONS,
  ENTITY_PROPERTY_OPTIONS,
  EXPRESSION_OPERATOR_OPTIONS,
  VALUE_SOURCE_OPTIONS,
} from './value-source-options'

const inputClass =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'

type SourceKind = 'literal' | LogicValueSource['source']
type AtomSourceKind = Exclude<SourceKind, 'expression'>

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

function atomDefault(kind: AtomSourceKind, numeric: boolean): LogicValueAtom {
  switch (kind) {
    case 'literal':
      return numeric ? 0 : ''
    case 'global':
      return { source: 'global', key: '' }
    case 'local':
      return { source: 'local', target: 'self', key: '' }
    case 'message':
      return { source: 'message', key: '', fallback: numeric ? 0 : '' }
    case 'entity':
      return { source: 'entity', target: 'self', property: 'positionX' }
    case 'component':
      return { source: 'component', target: 'self', property: 'linearMover.speed', fallback: 0 }
    case 'random':
      return { source: 'random', min: 0, max: 1 }
  }
}

function sourceDefault(kind: SourceKind, numeric: boolean): LogicValue {
  if (kind !== 'expression') return atomDefault(kind, numeric)
  return {
    source: 'expression',
    initial: 0,
    operations: [{ operator: 'add', value: 0 }],
  }
}

function AtomField({
  value,
  numeric,
  onChange,
  showSource = true,
}: Readonly<{
  value: LogicValueAtom
  numeric: boolean
  onChange: (value: LogicValueAtom) => void
  showSource?: boolean
}>) {
  const kind = sourceKind(value) as AtomSourceKind
  const atomOptions = VALUE_SOURCE_OPTIONS.filter((option) => option.value !== 'expression')

  return (
    <span className="flex items-center flex-wrap gap-1">
      {showSource && (
        <EditorSelect
          className="w-auto"
          triggerClassName="py-1"
          value={kind}
          onChange={(next) => onChange(atomDefault(next as AtomSourceKind, numeric))}
          options={atomOptions}
          aria-label="Operand source"
        />
      )}
      {kind === 'literal' && (
        <input
          className={`${inputClass} w-24`}
          type={numeric ? 'number' : 'text'}
          value={String(value)}
          onChange={(event) => onChange(literalFromInput(event.target.value, numeric))}
        />
      )}
      {kind === 'global' && typeof value === 'object' && value.source === 'global' && (
        <VariableKeyPicker scope="global" value={value.key} onChange={(key) => onChange({ ...value, key })} />
      )}
      {kind === 'local' && typeof value === 'object' && value.source === 'local' && (
        <>
          <TargetPicker value={value.target} onChange={(target) => onChange({ ...value, target })} />
          <VariableKeyPicker scope="local" value={value.key} onChange={(key) => onChange({ ...value, key })} />
        </>
      )}
      {kind === 'message' && typeof value === 'object' && value.source === 'message' && (
        <input
          className={`${inputClass} w-28`}
          placeholder="Payload key"
          value={value.key}
          onChange={(event) => onChange({ ...value, key: event.target.value })}
        />
      )}
      {kind === 'entity' && typeof value === 'object' && value.source === 'entity' && (
        <>
          <TargetPicker value={value.target} onChange={(target) => onChange({ ...value, target })} />
          <EditorSelect
            className="w-auto"
            triggerClassName="py-1"
            value={value.property}
            onChange={(property) => onChange({ ...value, property: property as typeof value.property })}
            options={ENTITY_PROPERTY_OPTIONS}
            aria-label="Object property"
          />
        </>
      )}
      {kind === 'component' && typeof value === 'object' && value.source === 'component' && (
        <>
          <TargetPicker value={value.target} onChange={(target) => onChange({ ...value, target })} />
          <EditorSelect
            className="w-auto"
            triggerClassName="py-1"
            value={value.property}
            onChange={(property) => onChange({ ...value, property: property as typeof value.property })}
            options={COMPONENT_PROPERTY_OPTIONS}
            aria-label="Component property"
          />
        </>
      )}
      {kind === 'random' && typeof value === 'object' && value.source === 'random' && (
        <>
          <input
            className={`${inputClass} w-20`}
            type="number"
            aria-label="Minimum"
            value={value.min}
            onChange={(event) => onChange({ ...value, min: parseLogicNumber(event.target.value) ?? 0 })}
          />
          <span className="text-[10px] text-[var(--muted)]">to</span>
          <input
            className={`${inputClass} w-20`}
            type="number"
            aria-label="Maximum"
            value={value.max}
            onChange={(event) => onChange({ ...value, max: parseLogicNumber(event.target.value) ?? 0 })}
          />
        </>
      )}
    </span>
  )
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

  if (kind !== 'expression' || typeof current !== 'object' || current.source !== 'expression') {
    return (
      <span className="flex items-center flex-wrap gap-1">
        <EditorSelect
          className="w-auto"
          triggerClassName="py-1"
          value={kind}
          onChange={(next) => onChange(sourceDefault(next as SourceKind, numeric))}
          options={VALUE_SOURCE_OPTIONS}
          aria-label="Value source"
        />
        <AtomField
          value={current as LogicValueAtom}
          numeric={numeric}
          onChange={onChange}
          showSource={false}
        />
      </span>
    )
  }

  return (
    <span className="flex flex-col gap-1 rounded border border-[var(--border-2)] p-1">
      <span className="flex items-center gap-1">
        <EditorSelect
          className="w-auto"
          triggerClassName="py-1"
          value="expression"
          onChange={(next) => onChange(sourceDefault(next as SourceKind, numeric))}
          options={VALUE_SOURCE_OPTIONS}
          aria-label="Value source"
        />
        <span className="text-[10px] text-[var(--muted)]">Start with</span>
        <AtomField
          value={current.initial}
          numeric
          onChange={(initial) => onChange({ ...current, initial })}
        />
      </span>
      {current.operations.map((operation, index) => (
        <span key={index} className="flex items-center gap-1 pl-4">
          <EditorSelect
            className="w-auto"
            triggerClassName="py-1"
            value={operation.operator}
            onChange={(operator) => {
              const operations = current.operations.map((item, itemIndex) =>
                itemIndex === index ? { ...item, operator: operator as typeof item.operator } : item,
              )
              onChange({ ...current, operations })
            }}
            options={EXPRESSION_OPERATOR_OPTIONS}
            aria-label={`Expression operation ${index + 1}`}
          />
          <AtomField
            value={operation.value}
            numeric
            onChange={(nextValue) => {
              const operations = current.operations.map((item, itemIndex) =>
                itemIndex === index ? { ...item, value: nextValue } : item,
              )
              onChange({ ...current, operations })
            }}
          />
          {current.operations.length > 1 && (
            <button
              type="button"
              className="px-1 text-xs text-[var(--danger)]"
              aria-label={`Remove expression operation ${index + 1}`}
              onClick={() => onChange({
                ...current,
                operations: current.operations.filter((_, itemIndex) => itemIndex !== index),
              })}
            >
              Remove
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        className="self-start px-1 text-[10px] text-[var(--accent)]"
        onClick={() => onChange({
          ...current,
          operations: [...current.operations, { operator: 'add', value: 0 }],
        })}
      >
        + Add operation
      </button>
    </span>
  )
}
