// ---------------------------------------------------------------------------
// Inline editor for a single LogicEvent (expanded card body).
// Parameters driven by JSON Schema via SchemaParamForm.
// ---------------------------------------------------------------------------

import type { LogicAction, LogicEvent, LogicTrigger } from '../../types/logic-board'
import { SchemaParamForm } from '../../components/logic-board/SchemaParamForm'
import { ConditionTreeEditor } from '../../components/logic-board/ConditionTreeEditor'
import {
  ACTION_TYPES,
  TRIGGER_TYPES,
  defaultAction,
  defaultTrigger,
} from './options'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] uppercase tracking-wider text-[var(--muted)]'
const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'

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

function ActionRow({
  act,
  onChange,
  onRemove,
}: {
  act: LogicAction
  onChange: (a: LogicAction) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center flex-wrap gap-2 bg-[var(--panel)] border border-[var(--border)] rounded px-2 py-1.5">
      <select
        className={`${sel} text-[var(--warn)]`}
        value={act.type}
        onChange={(e) =>
          onChange(defaultAction(e.target.value as LogicAction['type']))
        }
      >
        {ACTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <SchemaParamForm
        kind="action"
        type={act.type}
        value={act as unknown as Record<string, unknown>}
        onChange={(next) => onChange(next as LogicAction)}
      />
      <div className="flex-1" />
      <button className={link} onClick={onRemove} title="remove">
        ✕
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
  return (
    <div className="p-3 bg-[var(--panel-3)] border-t border-[var(--border)] space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--accent)]">
        Edit Logic Event
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`${lbl} w-20`}>Trigger</span>
        <select
          className={sel}
          value={event.trigger.type}
          onChange={(e) =>
            onChange({
              ...event,
              trigger: defaultTrigger(e.target.value as LogicTrigger['type']),
            })
          }
        >
          {TRIGGER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <TriggerFields
          trigger={event.trigger}
          onChange={(t) => onChange({ ...event, trigger: t })}
        />
      </div>

      <div className="flex items-start gap-3">
        <span className={`${lbl} w-20 pt-2`}>Conditions</span>
        <div className="flex-1">
          <ConditionTreeEditor event={event} onChange={onChange} />
        </div>
      </div>

      <div className="flex items-start gap-3">
        <span className={`${lbl} w-20 pt-2`}>Actions</span>
        <div className="flex-1 space-y-1.5">
          {event.actions.length === 0 && (
            <div className="text-[11px] text-[var(--muted-2)]">no actions yet</div>
          )}
          {event.actions.map((a, i) => (
            <ActionRow
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
          <button
            className={link}
            onClick={() =>
              onChange({
                ...event,
                actions: [...event.actions, defaultAction('debugLog')],
              })
            }
          >
            ＋ add action
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          className="px-3 py-1.5 rounded text-xs font-semibold bg-[var(--accent-bg)] border border-[var(--accent-bd)] text-[var(--accent)]"
          onClick={onDone}
        >
          ✓ Done
        </button>
      </div>
    </div>
  )
}
