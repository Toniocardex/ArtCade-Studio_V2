// ---------------------------------------------------------------------------
// Dynamic parameter form driven by JSON Schema x-artcade.params metadata
// ---------------------------------------------------------------------------

import {
  getComponentMeta,
  type ComponentKind,
  type ParamFieldMeta,
} from '../../utils/logic-board/schema-registry'
import { parseLogicNumber } from '../../utils/logic-board/parse-logic-number'
import type { TargetSelector } from '../../types/logic-board'
import { enumDisplayLabel, fieldDisplayLabel } from '../../panels/logic-board/friendly-labels'
import { TargetPicker } from './TargetPicker'
import { KeyCapture } from './KeyCapture'
import { ClassNamePicker } from './ClassNamePicker'
import { TagPicker } from './TagPicker'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] text-[var(--muted)]'

function Num({
  value,
  onChange,
  w = 'w-20',
  placeholder,
  allowEmpty = false,
  emptyDefault = 0,
}: {
  value: number | undefined
  onChange: (n: number | undefined) => void
  w?: string
  placeholder?: string
  /** When true, clearing the field calls onChange(undefined) instead of 0. */
  allowEmpty?: boolean
  /** Display/fallback when value is undefined and allowEmpty is false. */
  emptyDefault?: number
}) {
  const display =
    value !== undefined && value !== null && Number.isFinite(value)
      ? String(value)
      : allowEmpty
        ? ''
        : String(emptyDefault)

  return (
    <input
      type="text"
      inputMode="decimal"
      className={`${inp} ${w}`}
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value
        if (allowEmpty && raw.trim() === '') {
          onChange(undefined)
          return
        }
        const n = parseLogicNumber(raw)
        if (n !== undefined) onChange(n)
        else if (!allowEmpty) onChange(emptyDefault)
      }}
    />
  )
}

function Txt({
  value,
  onChange,
  w = 'w-40',
  placeholder,
}: {
  value: string
  onChange: (s: string) => void
  w?: string
  placeholder?: string
}) {
  return (
    <input
      className={`${inp} ${w}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function Field({
  kind,
  type,
  name,
  meta,
  value,
  onPatch,
}: {
  kind: ComponentKind
  type: string
  name: string
  meta: ParamFieldMeta
  value: unknown
  onPatch: (key: string, val: unknown) => void
}) {
  const displayLabel =
    fieldDisplayLabel(kind, type, name) ?? meta.label ?? name
  const label = <span className={lbl}>{displayLabel}</span>
  const enumCtx = `${kind}:${type}:${name}`

  switch (meta.widget) {
    case 'number': {
      const allowEmpty =
        kind === 'action' &&
        type === 'repeatTimes' &&
        name === 'intervalSeconds'
      const numValue = typeof value === 'number' && Number.isFinite(value) ? value : undefined
      const emptyDefault =
        kind === 'action' && type === 'repeatTimes' && name === 'count'
          ? 3
          : kind === 'action' && type === 'cameraShake' && name === 'trauma'
            ? 0.5
            : 0
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <Num
            value={numValue}
            allowEmpty={allowEmpty}
            emptyDefault={emptyDefault}
            placeholder={
              allowEmpty
                ? meta.placeholder ?? '0.5'
                : kind === 'action' && type === 'cameraShake' && name === 'trauma'
                  ? meta.placeholder ?? '0.5'
                  : meta.placeholder
            }
            onChange={(n) => onPatch(name, n)}
          />
        </span>
      )
    }
    case 'boolean':
      return (
        <label key={name} className="flex items-center gap-1 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onPatch(name, e.target.checked)}
          />
          {displayLabel}
        </label>
      )
    case 'enum':
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <select
            className={sel}
            value={String(value ?? meta.options?.[0] ?? '')}
            onChange={(e) => onPatch(name, e.target.value)}
          >
            {(meta.options ?? []).map((o) => (
              <option key={o} value={o}>
                {enumDisplayLabel(enumCtx, o)}
              </option>
            ))}
          </select>
        </span>
      )
    case 'target':
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <TargetPicker
            value={(value as TargetSelector) ?? 'self'}
            onChange={(t) => onPatch(name, t)}
          />
        </span>
      )
    case 'color':
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <input
            type="color"
            value={typeof value === 'string' && value ? value : '#ffffff'}
            onChange={(e) => onPatch(name, e.target.value)}
            className="w-7 h-6 bg-transparent border border-[var(--border-2)] rounded"
          />
        </span>
      )
    case 'keyCapture':
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <KeyCapture
            value={value != null ? String(value) : ''}
            placeholder={meta.placeholder}
            onChange={(code) => onPatch(name, code)}
          />
        </span>
      )
    case 'className':
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <ClassNamePicker
            value={value != null ? String(value) : ''}
            onChange={(s) => onPatch(name, s)}
            allowEmpty={
              (kind === 'trigger' && name === 'withClass') ||
              (kind === 'condition' && type === 'raycastHit' && name === 'className')
            }
          />
        </span>
      )
    case 'entityTag':
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <TagPicker
            value={value != null ? String(value) : ''}
            onChange={(s) => onPatch(name, s)}
            allowEmpty={kind === 'trigger' && name === 'withClass'}
          />
        </span>
      )
    case 'string':
    default:
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <Txt
            value={value != null ? String(value) : ''}
            placeholder={meta.placeholder}
            onChange={(s) => {
              if (name === 'value' || name === 'payloadValue') {
                onPatch(name, s !== '' && !isNaN(Number(s)) ? Number(s) : s)
              } else {
                onPatch(name, s)
              }
            }}
          />
        </span>
      )
  }
}

export interface SchemaParamFormProps {
  kind: ComponentKind
  type: string
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

export function SchemaParamForm({ kind, type, value, onChange }: SchemaParamFormProps) {
  const meta = getComponentMeta(kind, type)
  if (!meta || Object.keys(meta.params).length === 0) return null

  const patch = (key: string, val: unknown) => {
    onChange({ ...value, type, [key]: val })
  }

  return (
    <span className="flex items-center flex-wrap gap-2">
      {Object.entries(meta.params).map(([name, fieldMeta]) => (
        <Field
          key={name}
          kind={kind}
          type={type}
          name={name}
          meta={fieldMeta}
          value={value[name]}
          onPatch={patch}
        />
      ))}
    </span>
  )
}
