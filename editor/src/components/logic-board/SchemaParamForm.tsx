// ---------------------------------------------------------------------------
// Dynamic parameter form driven by JSON Schema x-artcade.params metadata
// ---------------------------------------------------------------------------

import type { ReactElement } from 'react'
import { DialogIdField } from './DialogIdField'
import {
  getComponentMeta,
  type ComponentKind,
  type ParamFieldMeta,
  type ParamWidget,
} from '../../utils/logic-board/schema-registry'
import { parseLogicNumber } from '../../utils/logic-board/parse-logic-number'
import type { CollisionFilter, LogicValue, TargetSelector } from '../../types/logic-board'
import { enumDisplayLabel, fieldDisplayLabel } from '../../panels/logic-board/friendly-labels'
import { TargetPicker } from './TargetPicker'
import { KeyCapture } from './KeyCapture'
import { ClassNamePicker } from './ClassNamePicker'
import { ClipPicker } from './ClipPicker'
import { TagPicker } from './TagPicker'
import { EditorSelect } from '../ui/EditorSelect'
import { ValueSourceField } from './ValueSourceField'
import { VariableKeyPicker } from './VariableKeyPicker'

const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] text-[var(--muted)]'

/** Avoid `[object Object]` when schema values are not primitives. */
function asParamString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  return fallback
}

function enumSelectValue(value: unknown, options: readonly string[] | undefined): string {
  if (typeof value === 'string') return value
  const first = options?.[0]
  return typeof first === 'string' ? first : ''
}

function numDisplayValue(
  value: number | undefined,
  allowEmpty: boolean,
  emptyDefault: number,
): string {
  if (value !== undefined && value !== null && Number.isFinite(value)) {
    return String(value)
  }
  if (allowEmpty) return ''
  return String(emptyDefault)
}

function numberEmptyDefault(kind: ComponentKind, type: string, name: string): number {
  if (kind === 'action' && type === 'repeatTimes' && name === 'count') return 3
  if (kind === 'action' && type === 'cameraShake' && name === 'trauma') return 0.35
  if (kind === 'action' && type === 'cameraShake' && name === 'durationSeconds') return 0.5
  return 0
}

function numberPlaceholder(
  kind: ComponentKind,
  type: string,
  name: string,
  meta: ParamFieldMeta,
  allowEmpty: boolean,
): string | undefined {
  if (allowEmpty) return meta.placeholder ?? '0.5'
  const isCameraTrauma =
    kind === 'action' && type === 'cameraShake' && name === 'trauma'
  if (isCameraTrauma) return meta.placeholder ?? '0.5'
  return meta.placeholder
}

function repeatIntervalAllowEmpty(kind: ComponentKind, type: string, name: string): boolean {
  return kind === 'action' && type === 'repeatTimes' && name === 'intervalSeconds'
}

function classNameAllowEmpty(kind: ComponentKind, type: string, name: string): boolean {
  return kind === 'condition' && type === 'raycastHit' && name === 'className'
}

function tagAllowEmpty(): boolean {
  return false
}

function patchStringField(name: string, s: string, onPatch: (key: string, val: unknown) => void): void {
  if (name !== 'value' && name !== 'payloadValue') {
    onPatch(name, s)
    return
  }
  if (s === '') {
    onPatch(name, s)
    return
  }
  const parsed = Number(s)
  onPatch(name, Number.isNaN(parsed) ? s : parsed)
}

type NumProps = Readonly<{
  value: number | undefined
  onChange: (n: number | undefined) => void
  w?: string
  placeholder?: string
  /** When true, clearing the field calls onChange(undefined) instead of 0. */
  allowEmpty?: boolean
  /** Display/fallback when value is undefined and allowEmpty is false. */
  emptyDefault?: number
}>

function Num({
  value,
  onChange,
  w = 'w-20',
  placeholder,
  allowEmpty = false,
  emptyDefault = 0,
}: NumProps) {
  const display = numDisplayValue(value, allowEmpty, emptyDefault)

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

type TxtProps = Readonly<{
  value: string
  onChange: (s: string) => void
  w?: string
  placeholder?: string
}>

function Txt({ value, onChange, w = 'w-40', placeholder }: TxtProps) {
  return (
    <input
      className={`${inp} ${w}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

type FieldProps = Readonly<{
  kind: ComponentKind
  type: string
  name: string
  meta: ParamFieldMeta
  value: unknown
  onPatch: (key: string, val: unknown) => void
}>

function fieldLabel(kind: ComponentKind, type: string, name: string, meta: ParamFieldMeta): string {
  return fieldDisplayLabel(kind, type, name) ?? meta.label ?? name
}

function renderNumberField({ kind, type, name, meta, value, onPatch }: FieldProps) {
  const allowEmpty = repeatIntervalAllowEmpty(kind, type, name)
  const numValue = typeof value === 'number' && Number.isFinite(value) ? value : undefined
  const emptyDefault = numberEmptyDefault(kind, type, name)

  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldLabel(kind, type, name, meta)}</span>
      <Num
        value={numValue}
        allowEmpty={allowEmpty}
        emptyDefault={emptyDefault}
        placeholder={numberPlaceholder(kind, type, name, meta, allowEmpty)}
        onChange={(n) => onPatch(name, n)}
      />
    </span>
  )
}

function renderBooleanField({ kind, type, name, meta, value, onPatch }: FieldProps) {
  return (
    <label key={name} className="flex items-center gap-1 text-xs text-[var(--muted)]">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onPatch(name, e.target.checked)}
      />
      {fieldLabel(kind, type, name, meta)}
    </label>
  )
}

function renderEnumField({ kind, type, name, meta, value, onPatch }: FieldProps) {
  const enumCtx = `${kind}:${type}:${name}`
  const options = meta.options ?? []

  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldLabel(kind, type, name, meta)}</span>
      <EditorSelect
        className="w-auto"
        triggerClassName="py-1"
        value={enumSelectValue(value, options)}
        onChange={(next) => onPatch(name, next)}
        options={options.map((o) => ({
          value: o,
          label: enumDisplayLabel(enumCtx, o),
        }))}
        aria-label={fieldLabel(kind, type, name, meta)}
      />
    </span>
  )
}

function renderTargetField({ kind, type, name, value, onPatch }: FieldProps) {
  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldDisplayLabel(kind, type, name) ?? name}</span>
      <TargetPicker
        value={(value as TargetSelector) ?? 'self'}
        onChange={(t) => onPatch(name, t)}
      />
    </span>
  )
}

function renderColorField({ kind, type, name, value, onPatch }: FieldProps) {
  const color =
    typeof value === 'string' && value.length > 0 ? value : '#ffffff'

  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldDisplayLabel(kind, type, name) ?? name}</span>
      <input
        type="color"
        value={color}
        onChange={(e) => onPatch(name, e.target.value)}
        className="w-7 h-6 bg-transparent border border-[var(--border-2)] rounded"
      />
    </span>
  )
}

function renderKeyCaptureField({ kind, type, name, meta, value, onPatch }: FieldProps) {
  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldLabel(kind, type, name, meta)}</span>
      <KeyCapture
        value={asParamString(value)}
        placeholder={meta.placeholder}
        onChange={(code) => onPatch(name, code)}
      />
    </span>
  )
}

function renderClassNameField({ kind, type, name, value, onPatch }: FieldProps) {
  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldDisplayLabel(kind, type, name) ?? name}</span>
      <ClassNamePicker
        value={asParamString(value)}
        onChange={(s) => onPatch(name, s)}
        allowEmpty={classNameAllowEmpty(kind, type, name)}
      />
    </span>
  )
}

function renderEntityTagField({ kind, type, name, value, onPatch }: FieldProps) {
  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldDisplayLabel(kind, type, name) ?? name}</span>
      <TagPicker
        value={asParamString(value)}
        onChange={(s) => onPatch(name, s)}
        allowEmpty={tagAllowEmpty()}
      />
    </span>
  )
}

type AnimationClipFieldProps = FieldProps & {
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
}

function renderAnimationClipField({
  kind,
  type,
  name,
  value,
  onPatch,
  contextSpritePath,
  ambiguousTargetSpritePaths,
}: AnimationClipFieldProps) {
  const allowEmpty = kind === 'action' && type === 'playAnimation'
  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldDisplayLabel(kind, type, name) ?? name}</span>
      <ClipPicker
        value={asParamString(value)}
        onChange={(s) => onPatch(name, s)}
        allowEmpty={allowEmpty}
        emptyLabel="— Choose clip —"
        filterSpritePath={contextSpritePath}
        ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
      />
    </span>
  )
}

function renderStringField({ kind, type, name, meta, value, onPatch }: FieldProps) {
  if (kind === 'action' && type === 'startDialog' && name === 'dialogId') {
    return (
      <DialogIdField
        key={name}
        kind={kind}
        type={type}
        name={name}
        meta={meta}
        value={value}
        onPatch={onPatch}
        label={fieldLabel(kind, type, name, meta)}
      />
    )
  }
  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{fieldLabel(kind, type, name, meta)}</span>
      <Txt
        value={asParamString(value)}
        placeholder={meta.placeholder}
        onChange={(s) => patchStringField(name, s, onPatch)}
      />
    </span>
  )
}

function renderValueSourceField({ name, meta, value, onPatch }: FieldProps) {
  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{meta.label}</span>
      <ValueSourceField
        value={value as LogicValue | undefined}
        numeric={meta.widget === 'numberSource'}
        onChange={(next) => onPatch(name, next)}
      />
    </span>
  )
}

function renderVariableField({ name, meta, value, onPatch }: FieldProps) {
  const scope = meta.widget === 'localVariable' ? 'local' : 'global'
  return (
    <span key={name} className="flex items-center gap-2">
      <span className={lbl}>{meta.label}</span>
      <VariableKeyPicker scope={scope} value={asParamString(value)} onChange={(key) => onPatch(name, key)} />
    </span>
  )
}

function renderCollisionFilterField({ name, value, onPatch }: FieldProps) {
  const filter = (value && typeof value === 'object' ? value : {}) as CollisionFilter
  const patchFilter = (key: keyof CollisionFilter, next: string) => {
    const clean = next.trim()
    const updated: CollisionFilter = { ...filter, [key]: clean || undefined }
    onPatch(name, updated)
  }

  return (
    <span key={name} className="flex items-center flex-wrap gap-2">
      <span className={lbl}>Filter</span>
      <Txt value={filter.layer ?? ''} w="w-24" placeholder="layer" onChange={(s) => patchFilter('layer', s)} />
      <EditorSelect
        className="w-auto"
        triggerClassName="py-1"
        value={filter.role ?? ''}
        onChange={(next) => patchFilter('role', next)}
        options={[
          { value: '', label: 'Any role' },
          { value: 'body', label: 'Body' },
          { value: 'feet', label: 'Feet' },
          { value: 'hurtbox', label: 'Hurtbox' },
          { value: 'hitbox', label: 'Hitbox' },
          { value: 'interaction', label: 'Interaction' },
        ]}
        aria-label="Collision role"
      />
      <EditorSelect
        className="w-auto"
        triggerClassName="py-1"
        value={filter.response ?? ''}
        onChange={(next) => patchFilter('response', next)}
        options={[
          { value: '', label: 'Any response' },
          { value: 'solid', label: 'Solid' },
          { value: 'sensor', label: 'Sensor' },
        ]}
        aria-label="Collision response"
      />
      <Txt value={filter.tag ?? ''} w="w-24" placeholder="tag" onChange={(s) => patchFilter('tag', s)} />
      <Txt value={filter.className ?? ''} w="w-28" placeholder="class" onChange={(s) => patchFilter('className', s)} />
    </span>
  )
}

const FIELD_RENDERERS: Record<ParamWidget, (props: FieldProps) => ReactElement> = {
  number: renderNumberField,
  boolean: renderBooleanField,
  enum: renderEnumField,
  target: renderTargetField,
  color: renderColorField,
  keyCapture: renderKeyCaptureField,
  className: renderClassNameField,
  entityTag: renderEntityTagField,
  animationClip: (props) => renderAnimationClipField(props),
  string: renderStringField,
  valueSource: renderValueSourceField,
  numberSource: renderValueSourceField,
  globalVariable: renderVariableField,
  localVariable: renderVariableField,
  collisionFilter: renderCollisionFilterField,
}

export type SchemaParamFormProps = Readonly<{
  kind: ComponentKind
  type: string
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  /** Entity rulesheet: prefer clips from this sprite sheet in animationClip fields. */
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
}>

export function SchemaParamForm({
  kind,
  type,
  value,
  onChange,
  contextSpritePath,
  ambiguousTargetSpritePaths,
}: SchemaParamFormProps) {
  const meta = getComponentMeta(kind, type)
  if (!meta || Object.keys(meta.params).length === 0) return null

  const patch = (key: string, val: unknown) => {
    onChange({ ...value, type, [key]: val })
  }

  return (
    <span className="flex items-center flex-wrap gap-2">
      {Object.entries(meta.params).map(([name, fieldMeta]) => {
        if (fieldMeta.visibleWhen) {
          const visible = Object.entries(fieldMeta.visibleWhen).every(
            ([key, expected]) => value[key] === expected,
          )
          if (!visible) return null
        }
        const fieldProps: FieldProps = {
          kind,
          type,
          name,
          meta: fieldMeta,
          value: value[name],
          onPatch: patch,
        }
        if (fieldMeta.widget === 'animationClip') {
          return renderAnimationClipField({
            ...fieldProps,
            contextSpritePath,
            ambiguousTargetSpritePaths,
          })
        }
        const render = FIELD_RENDERERS[fieldMeta.widget] ?? renderStringField
        return render(fieldProps)
      })}
    </span>
  )
}
