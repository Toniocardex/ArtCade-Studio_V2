// ---------------------------------------------------------------------------
// Dynamic parameter form driven by JSON Schema x-artcade.params metadata
// ---------------------------------------------------------------------------

import type { TargetSelector } from '../../types/logic-board'
import {
  getComponentMeta,
  type ComponentKind,
  type ParamFieldMeta,
} from '../../utils/logic-board/schema-registry'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] uppercase tracking-wider text-[var(--muted)]'

function Num({
  value,
  onChange,
  w = 'w-20',
}: {
  value: number
  onChange: (n: number) => void
  w?: string
}) {
  return (
    <input
      type="number"
      className={`${inp} ${w}`}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
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

function TargetPicker({
  value,
  onChange,
}: {
  value: TargetSelector
  onChange: (t: TargetSelector) => void
}) {
  const kind =
    value === 'self' || value === 'other'
      ? value
      : typeof value === 'object' && 'entityId' in value
        ? 'entityId'
        : 'className'
  return (
    <span className="flex items-center gap-1">
      <select
        className={sel}
        value={kind}
        onChange={(e) => {
          const k = e.target.value
          if (k === 'self' || k === 'other') onChange(k)
          else if (k === 'entityId') onChange({ entityId: 1 })
          else onChange({ className: '', first: true })
        }}
      >
        <option value="self">self</option>
        <option value="other">other</option>
        <option value="entityId">entity #</option>
        <option value="className">class</option>
      </select>
      {kind === 'entityId' && typeof value === 'object' && 'entityId' in value && (
        <Num w="w-16" value={value.entityId} onChange={(n) => onChange({ entityId: n })} />
      )}
      {kind === 'className' && typeof value === 'object' && 'className' in value && (
        <Txt
          w="w-28"
          placeholder="ClassName"
          value={value.className}
          onChange={(s) => onChange({ className: s, first: true })}
        />
      )}
    </span>
  )
}

function Field({
  name,
  meta,
  value,
  onPatch,
}: {
  name: string
  meta: ParamFieldMeta
  value: unknown
  onPatch: (key: string, val: unknown) => void
}) {
  const label = <span className={lbl}>{meta.label || name}</span>

  switch (meta.widget) {
    case 'number':
      return (
        <span key={name} className="flex items-center gap-2">
          {label}
          <Num
            value={typeof value === 'number' ? value : 0}
            onChange={(n) => onPatch(name, n)}
          />
        </span>
      )
    case 'boolean':
      return (
        <label key={name} className="flex items-center gap-1 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onPatch(name, e.target.checked)}
          />
          {meta.label || name}
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
                {o}
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
          name={name}
          meta={fieldMeta}
          value={value[name]}
          onPatch={patch}
        />
      ))}
    </span>
  )
}
