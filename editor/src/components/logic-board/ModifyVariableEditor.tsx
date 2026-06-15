// ---------------------------------------------------------------------------
// ModifyVariableEditor — unified, friendly editor for `modifyVariable`
// ---------------------------------------------------------------------------
//
// Replaces the old per-(scope×operation) action forms with a single card:
//   Operation (= += −= ×= ÷=)  ·  Scope (Global / This object)
//   Variable  ·  [Object target]  ·  Value (literal | variable | expression)
//   live preview line, e.g.  Player.hp −= 10
//
// Legacy set/add{Global,Local}Variable instances are normalized on read and
// migrated to `modifyVariable` on the first edit (the parent persists what we
// emit via onChange).

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
  target: TargetSelector
}>

/** Map any current (possibly legacy) variable action to the unified model. */
export function normalizeVariableAction(a: LogicAction): ModifyModel {
  switch (a.type) {
    case 'modifyVariable':
      return { scope: a.scope, op: a.op, key: a.key, value: a.value, target: a.target ?? 'self' }
    case 'setGlobalVariable':
    case 'setVariable':
      return { scope: 'global', op: 'set', key: a.key, value: a.value, target: 'self' }
    case 'addGlobalVariable':
    case 'addVariable':
      return { scope: 'global', op: 'add', key: a.key, value: a.amount, target: 'self' }
    case 'setLocalVariable':
      return { scope: 'object', op: 'set', key: a.key, value: a.value, target: a.target }
    case 'addLocalVariable':
      return { scope: 'object', op: 'add', key: a.key, value: a.amount, target: a.target }
    case 'multiplyVariable':
      return { scope: 'global', op: 'multiply', key: a.key, value: a.factor, target: 'self' }
    default:
      return { scope: 'global', op: 'add', key: 'score', value: 1, target: 'self' }
  }
}

function toAction(m: ModifyModel): LogicAction {
  const base = { type: 'modifyVariable' as const, scope: m.scope, op: m.op, key: m.key, value: m.value }
  return m.scope === 'object' ? { ...base, target: m.target } : base
}

const OP_OPTIONS = [
  { value: 'set',      label: '=  Set' },
  { value: 'add',      label: '+=  Add' },
  { value: 'subtract', label: '−=  Subtract' },
  { value: 'multiply', label: '×=  Multiply' },
  { value: 'divide',   label: '÷=  Divide' },
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

      <label className="flex flex-col gap-0.5">
        <span className="text-[9px] uppercase text-[var(--muted)]">Value</span>
        <ValueSourceField value={model.value} numeric onChange={(value) => emit({ value })} />
      </label>

      <p className="rounded bg-[var(--panel-2)] px-2 py-1 font-mono text-[11px] text-[var(--accent)]">
        {actionSummaryPlain(toAction(model), project)}
      </p>
    </div>
  )
}
