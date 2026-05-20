// ---------------------------------------------------------------------------
// Expanded rule editor — When / Only if / Then blocks
// ---------------------------------------------------------------------------

import { useState } from 'react'
import type { LogicAction, LogicEvent, LogicTrigger } from '../../types/logic-board'
import { LogicBlock } from '../../components/logic-board/LogicBlock'
import { TypePicker } from '../../components/logic-board/TypePicker'
import { SchemaParamForm } from '../../components/logic-board/SchemaParamForm'
import { ConditionTreeEditor } from '../../components/logic-board/ConditionTreeEditor'
import { defaultConditionRoot } from '../../utils/logic-board/schema-registry'
import { actionDisplayName } from './friendly-labels'
import {
  ACTION_TYPES,
  TRIGGER_TYPES,
  CONDITION_TYPES,
  defaultAction,
  defaultTrigger,
  defaultCondition,
} from './options'

const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'
const btn =
  'px-3 py-1.5 rounded text-xs font-medium border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] hover:border-[var(--accent-bd)]'

function TriggerFields({
  trigger,
  onChange,
}: {
  trigger: LogicTrigger
  onChange: (t: LogicTrigger) => void
}) {
  return (
    <SchemaParamForm
      kind="trigger"
      type={trigger.type}
      value={trigger as unknown as Record<string, unknown>}
      onChange={(next) => onChange(next as LogicTrigger)}
    />
  )
}

function ActionCard({
  act,
  onChange,
  onRemove,
}: {
  act: LogicAction
  onChange: (a: LogicAction) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg)] p-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <TypePicker
          kind="action"
          types={ACTION_TYPES}
          value={act.type}
          onChange={(t) => onChange(defaultAction(t as LogicAction['type']))}
          className="max-w-[220px]"
        />
        <span className="text-[10px] text-[var(--muted)]">
          {actionDisplayName(act.type)}
        </span>
        <div className="flex-1" />
        <button type="button" className={link} onClick={onRemove} title="Remove action">
          Remove
        </button>
      </div>
      <SchemaParamForm
        kind="action"
        type={act.type}
        value={act as unknown as Record<string, unknown>}
        onChange={(next) => onChange(next as LogicAction)}
      />
      {act.type === 'spawnEntity' && (
        <p className="text-[10px] text-[var(--muted)]">
          Creates a new copy of that object in the level.
        </p>
      )}
    </div>
  )
}

function SimpleConditions({
  event,
  onChange,
}: {
  event: LogicEvent
  onChange: (e: LogicEvent) => void
}) {
  const conditions = event.conditions ?? []

  return (
    <div className="space-y-2">
      {conditions.length === 0 && (
        <p className="text-[11px] text-[var(--muted)] italic">
          No extra checks — actions always run when the trigger fires.
        </p>
      )}
      {conditions.map((c, i) => (
        <div
          key={i}
          className="flex items-center flex-wrap gap-2 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
        >
          <TypePicker
            kind="condition"
            types={CONDITION_TYPES}
            value={c.type}
            onChange={(t) => {
              const next = conditions.slice()
              next[i] = defaultCondition(t as (typeof CONDITION_TYPES)[number])
              onChange({ ...event, conditions: next, conditionRoot: undefined })
            }}
            className="max-w-[200px]"
          />
          <SchemaParamForm
            kind="condition"
            type={c.type}
            value={c as unknown as Record<string, unknown>}
            onChange={(next) => {
              const conds = conditions.slice()
              conds[i] = next as typeof c
              onChange({ ...event, conditions: conds })
            }}
          />
          <button
            type="button"
            className={link}
            onClick={() =>
              onChange({
                ...event,
                conditions: conditions.filter((_, j) => j !== i),
              })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className={link}
        onClick={() =>
          onChange({
            ...event,
            conditions: [...conditions, defaultCondition('compareVariable')],
            conditionRoot: undefined,
          })
        }
      >
        + Add check
      </button>
    </div>
  )
}

export default function EventEditor({
  event,
  onChange,
  onDone,
}: {
  event: LogicEvent
  onChange: (e: LogicEvent) => void
  onDone: () => void
}) {
  const [advancedConditions, setAdvancedConditions] = useState(
    () => event.conditionRoot != null,
  )
  const [newActionType, setNewActionType] = useState<LogicAction['type']>('spawnEntity')

  return (
    <div className="p-3 bg-[var(--panel-3)] border-t border-[var(--border)] space-y-3">
      <LogicBlock title="When" hint="What should start this rule?">
        <TypePicker
          kind="trigger"
          types={TRIGGER_TYPES}
          value={event.trigger.type}
          onChange={(t) =>
            onChange({
              ...event,
              trigger: defaultTrigger(t as LogicTrigger['type']),
            })
          }
        />
        <TriggerFields
          trigger={event.trigger}
          onChange={(t) => onChange({ ...event, trigger: t })}
        />
      </LogicBlock>

      <LogicBlock
        title="Only if"
        optional
        hint="Leave empty to always run the actions below."
      >
        {!advancedConditions ? (
          <>
            <SimpleConditions event={event} onChange={onChange} />
            <button
              type="button"
              className={link}
              onClick={() => {
                setAdvancedConditions(true)
                if (!event.conditionRoot) {
                  onChange({
                    ...event,
                    conditionRoot: defaultConditionRoot(),
                    conditions: undefined,
                  })
                }
              }}
            >
              Advanced conditions (combine with AND / OR)…
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={link}
              onClick={() => {
                setAdvancedConditions(false)
                onChange({ ...event, conditionRoot: undefined })
              }}
            >
              ← Back to simple checks
            </button>
            <ConditionTreeEditor event={event} onChange={onChange} advanced />
          </>
        )}
      </LogicBlock>

      <LogicBlock title="Then" hint="What happens when this rule runs.">
        {event.actions.length === 0 && (
          <p className="text-[11px] text-[var(--muted)]">Add at least one action.</p>
        )}
        {event.actions.map((a, i) => (
          <ActionCard
            key={i}
            act={a}
            onChange={(na) => {
              const next = event.actions.slice()
              next[i] = na
              onChange({ ...event, actions: next })
            }}
            onRemove={() =>
              onChange({
                ...event,
                actions: event.actions.filter((_, j) => j !== i),
              })
            }
          />
        ))}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <TypePicker
            kind="action"
            types={ACTION_TYPES}
            value={newActionType}
            onChange={(t) => setNewActionType(t as LogicAction['type'])}
            className="max-w-[240px]"
          />
          <button
            type="button"
            className={btn}
            onClick={() =>
              onChange({
                ...event,
                actions: [...event.actions, defaultAction(newActionType)],
              })
            }
          >
            Add action
          </button>
        </div>
      </LogicBlock>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="px-4 py-2 rounded text-xs font-semibold bg-[var(--accent-bg)] border border-[var(--accent-bd)] text-[var(--accent)]"
          onClick={onDone}
        >
          Save rule
        </button>
      </div>
    </div>
  )
}
