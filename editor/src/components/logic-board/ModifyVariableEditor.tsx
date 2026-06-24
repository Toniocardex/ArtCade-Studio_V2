// ---------------------------------------------------------------------------
// ModifyVariableEditor — unified, friendly editor for `modifyVariable`
// ---------------------------------------------------------------------------
//
// One friendly card for every variable mutation:
//   Operation (= += −= ×= ÷= clamp)  ·  Scope (Global / This object)
//   Variable  ·  [Object target]  ·  Value  (or Min/Max for clamp)
//   live preview line, e.g.  Player.hp −= 10
//
// The Dialog-system `setVariable`/`addVariable` shapes are normalized on read
// and emitted as `modifyVariable` on the first edit.

import type {
  LogicAction, LogicValue, TargetSelector, VariableOp, VariableScope,
} from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { EditorSelect } from '../ui/EditorSelect'
import { TargetPicker } from './TargetPicker'
import { ValueSourceField } from './ValueSourceField'
import { VariableKeyPicker } from './VariableKeyPicker'
import { actionSummaryPlain } from '../../panels/logic-board/labels/summaries-action'

type ModifyModel = Readonly<{
  scope: VariableScope
  op: VariableOp
  key: string
  value: LogicValue
  min: LogicValue
  max: LogicValue
  target: TargetSelector
}>

const MODEL_DEFAULTS = { value: 0 as LogicValue, min: 0 as LogicValue, max: 100 as LogicValue, target: 'self' as TargetSelector }

/** Map any current variable action (unified or Dialog-side) to the model. */
export function normalizeVariableAction(a: LogicAction): ModifyModel {
  switch (a.type) {
    case 'modifyVariable':
      return {
        ...MODEL_DEFAULTS,
        scope: a.scope, op: a.op, key: a.key,
        value: a.value ?? 0, min: a.min ?? 0, max: a.max ?? 100,
        target: a.target ?? 'self',
      }
    case 'setVariable':
      return { ...MODEL_DEFAULTS, scope: 'global', op: 'set', key: a.key, value: a.value }
    case 'addVariable':
      return { ...MODEL_DEFAULTS, scope: 'global', op: 'add', key: a.key, value: a.amount }
    default:
      return { ...MODEL_DEFAULTS, scope: 'global', op: 'add', key: 'score', value: 1 }
  }
}

function toAction(m: ModifyModel): LogicAction {
  if (m.op === 'clamp') {
    const base = { type: 'modifyVariable' as const, scope: m.scope, op: 'clamp' as const, key: m.key, min: m.min, max: m.max }
    return m.scope === 'object' ? { ...base, target: m.target } : base
  }
  const base = { type: 'modifyVariable' as const, scope: m.scope, op: m.op, key: m.key, value: m.value }
  return m.scope === 'object' ? { ...base, target: m.target } : base
}

const OP_OPTIONS = [
  { value: 'set',      label: '=  Set' },
  { value: 'add',      label: '+=  Add' },
  { value: 'subtract', label: '−=  Subtract' },
  { value: 'multiply', label: '×=  Multiply' },
  { value: 'divide',   label: '÷=  Divide' },
  { value: 'clamp',    label: '⊓  Clamp (min/max)' },
] as const

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global variable' },
  { value: 'object', label: 'This object' },
] as const

export function ModifyVariableEditor({
  action,
  project,
  onChange,
}: Readonly<{
  action: LogicAction
  project?: ProjectDoc | null
  onChange: (a: LogicAction) => void
}>) {
  const model = normalizeVariableAction(action)
  const emit = (patch: Partial<ModifyModel>) => onChange(toAction({ ...model, ...patch }))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase text-[var(--muted)]">Operation</span>
          <EditorSelect
            className="w-auto"
            triggerClassName="py-1"
            value={model.op}
            onChange={(op) => emit({ op: op as VariableOp })}
            options={OP_OPTIONS}
            aria-label="Operation"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase text-[var(--muted)]">Scope</span>
          <EditorSelect
            className="w-auto"
            triggerClassName="py-1"
            value={model.scope}
            onChange={(scope) => emit({ scope: scope as VariableScope })}
            options={SCOPE_OPTIONS}
            aria-label="Scope"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase text-[var(--muted)]">Variable</span>
          <VariableKeyPicker
            scope={model.scope === 'object' ? 'local' : 'global'}
            value={model.key}
            onChange={(key) => emit({ key })}
          />
        </label>
      </div>

      {model.scope === 'object' && (
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase text-[var(--muted)]">Object</span>
          <TargetPicker value={model.target} onChange={(target) => emit({ target })} />
        </label>
      )}

      {model.op === 'clamp' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase text-[var(--muted)]">Min</span>
            <ValueSourceField value={model.min} numeric onChange={(min) => emit({ min })} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase text-[var(--muted)]">Max</span>
            <ValueSourceField value={model.max} numeric onChange={(max) => emit({ max })} />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase text-[var(--muted)]">Value</span>
          <ValueSourceField value={model.value} numeric onChange={(value) => emit({ value })} />
        </label>
      )}

      <p className="rounded bg-[var(--panel-2)] px-2 py-1 font-mono text-[11px] text-[var(--accent)]">
        {actionSummaryPlain(toAction(model), project)}
      </p>
    </div>
  )
}
