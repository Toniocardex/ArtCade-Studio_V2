// ---------------------------------------------------------------------------
// Inline editor for a single LogicEvent (expanded card body).
// Fully controlled: every change calls onChange(nextEvent); the parent
// dispatches LOGIC_UPDATE_EVENT so the Lua preview recompiles live.
// ---------------------------------------------------------------------------

import type {
  LogicAction,
  LogicCondition,
  LogicEvent,
  LogicTrigger,
  TargetSelector,
} from '../../types/logic-board'
import {
  ACTION_TYPES,
  CONDITION_TYPES,
  COMPARISON_OPS,
  INPUT_EVENT_TYPES,
  TRIGGER_TYPES,
  defaultAction,
  defaultCondition,
  defaultTrigger,
} from './options'

// ---- tiny styled primitives ----------------------------------------------

const sel =
  'bg-[#0B1121] border border-[#2D3748] text-[#00FFFF] px-2 py-1 rounded text-xs'
const inp =
  'bg-[#0B1121] border border-[#2D3748] text-[#D1D5DB] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] uppercase tracking-wider text-[#9CA3AF]'
const link = 'text-[#00FFFF] text-[11px] hover:underline cursor-pointer'

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

// ---- target selector ------------------------------------------------------

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
        <Num
          w="w-16"
          value={value.entityId}
          onChange={(n) => onChange({ entityId: n })}
        />
      )}
      {kind === 'className' &&
        typeof value === 'object' &&
        'className' in value && (
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

// ---- trigger fields -------------------------------------------------------

function TriggerFields({
  trigger,
  onChange,
}: {
  trigger: LogicTrigger
  onChange: (t: LogicTrigger) => void
}) {
  if (trigger.type === 'onCollision')
    return (
      <span className="flex items-center gap-2">
        <span className={lbl}>with class</span>
        <Txt
          value={trigger.withClass ?? ''}
          placeholder="Coin"
          onChange={(s) => onChange({ type: 'onCollision', withClass: s })}
        />
      </span>
    )
  if (trigger.type === 'onInput')
    return (
      <span className="flex items-center gap-2">
        <span className={lbl}>key</span>
        <Txt
          w="w-28"
          value={trigger.keyCode}
          placeholder="Space / KeyW"
          onChange={(s) => onChange({ ...trigger, keyCode: s })}
        />
        <select
          className={sel}
          value={trigger.eventType}
          onChange={(e) =>
            onChange({
              ...trigger,
              eventType: e.target.value as typeof trigger.eventType,
            })
          }
        >
          {INPUT_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </span>
    )
  if (trigger.type === 'onTimer')
    return (
      <span className="flex items-center gap-2">
        <span className={lbl}>every (s)</span>
        <Num
          value={trigger.seconds}
          onChange={(n) => onChange({ ...trigger, seconds: n })}
        />
        <label className="flex items-center gap-1 text-xs text-[#9CA3AF]">
          <input
            type="checkbox"
            checked={trigger.repeat}
            onChange={(e) =>
              onChange({ ...trigger, repeat: e.target.checked })
            }
          />
          repeat
        </label>
      </span>
    )
  return null
}

// ---- condition row --------------------------------------------------------

function ConditionRow({
  cond,
  onChange,
  onRemove,
}: {
  cond: LogicCondition
  onChange: (c: LogicCondition) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 bg-[#111827] border border-[#1A253A] rounded px-2 py-1.5">
      <select
        className={sel}
        value={cond.type}
        onChange={(e) =>
          onChange(defaultCondition(e.target.value as LogicCondition['type']))
        }
      >
        {CONDITION_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {cond.type === 'compareVariable' && (
        <>
          <Txt
            w="w-24"
            value={cond.key}
            onChange={(s) => onChange({ ...cond, key: s })}
          />
          <select
            className={sel}
            value={cond.operator}
            onChange={(e) =>
              onChange({
                ...cond,
                operator: e.target.value as (typeof COMPARISON_OPS)[number],
              })
            }
          >
            {COMPARISON_OPS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <Txt
            w="w-20"
            value={String(cond.value)}
            onChange={(s) =>
              onChange({
                ...cond,
                value: s !== '' && !isNaN(Number(s)) ? Number(s) : s,
              })
            }
          />
        </>
      )}
      {cond.type === 'compareClass' && (
        <Txt
          value={cond.className}
          placeholder="Enemy"
          onChange={(s) => onChange({ ...cond, className: s })}
        />
      )}
      {cond.type === 'isKeyDown' && (
        <Txt
          w="w-28"
          value={cond.keyCode}
          onChange={(s) => onChange({ ...cond, keyCode: s })}
        />
      )}
      {cond.type === 'chance' && (
        <Num
          value={cond.percent}
          onChange={(n) => onChange({ ...cond, percent: n })}
        />
      )}
      <div className="flex-1" />
      <button className={link} onClick={onRemove} title="remove">
        ✕
      </button>
    </div>
  )
}

// ---- action row -----------------------------------------------------------

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
    <div className="flex items-center flex-wrap gap-2 bg-[#111827] border border-[#1A253A] rounded px-2 py-1.5">
      <select
        className={`${sel} text-[#F97316]`}
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

      {act.type === 'setVariable' && (
        <>
          <span className={lbl}>key</span>
          <Txt w="w-24" value={act.key} onChange={(s) => onChange({ ...act, key: s })} />
          <span className={lbl}>value</span>
          <Txt
            w="w-20"
            value={String(act.value)}
            onChange={(s) =>
              onChange({
                ...act,
                value: s !== '' && !isNaN(Number(s)) ? Number(s) : s,
              })
            }
          />
        </>
      )}
      {act.type === 'addVariable' && (
        <>
          <span className={lbl}>key</span>
          <Txt w="w-24" value={act.key} onChange={(s) => onChange({ ...act, key: s })} />
          <span className={lbl}>amount</span>
          <Num value={act.amount} onChange={(n) => onChange({ ...act, amount: n })} />
        </>
      )}
      {(act.type === 'setPosition' || act.type === 'setVelocity') && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker
            value={act.target}
            onChange={(t) => onChange({ ...act, target: t })}
          />
          {act.type === 'setPosition' ? (
            <>
              <span className={lbl}>x</span>
              <Num value={act.x} onChange={(n) => onChange({ ...act, x: n })} />
              <span className={lbl}>y</span>
              <Num value={act.y} onChange={(n) => onChange({ ...act, y: n })} />
            </>
          ) : (
            <>
              <span className={lbl}>vx</span>
              <Num value={act.vx} onChange={(n) => onChange({ ...act, vx: n })} />
              <span className={lbl}>vy</span>
              <Num value={act.vy} onChange={(n) => onChange({ ...act, vy: n })} />
            </>
          )}
        </>
      )}
      {(act.type === 'playSound' || act.type === 'playMusic') && (
        <>
          <span className={lbl}>path</span>
          <Txt
            value={act.path}
            placeholder="sfx/coin.ogg"
            onChange={(s) => onChange({ ...act, path: s })}
          />
          {act.type === 'playMusic' && (
            <label className="flex items-center gap-1 text-xs text-[#9CA3AF]">
              <input
                type="checkbox"
                checked={act.loop !== false}
                onChange={(e) => onChange({ ...act, loop: e.target.checked })}
              />
              loop
            </label>
          )}
        </>
      )}
      {act.type === 'destroyEntity' && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker
            value={act.target}
            onChange={(t) => onChange({ ...act, target: t })}
          />
        </>
      )}
      {act.type === 'spawnEntity' && (
        <>
          <span className={lbl}>class</span>
          <Txt
            w="w-28"
            value={act.className}
            onChange={(s) => onChange({ ...act, className: s })}
          />
          <span className={lbl}>x</span>
          <Num value={act.x} onChange={(n) => onChange({ ...act, x: n })} />
          <span className={lbl}>y</span>
          <Num value={act.y} onChange={(n) => onChange({ ...act, y: n })} />
        </>
      )}
      {act.type === 'debugLog' && (
        <Txt
          w="w-56"
          value={act.message}
          placeholder="message"
          onChange={(s) => onChange({ ...act, message: s })}
        />
      )}

      <div className="flex-1" />
      <button className={link} onClick={onRemove} title="remove">
        ✕
      </button>
    </div>
  )
}

// ---- main editor ----------------------------------------------------------

export default function EventEditor({
  event,
  onChange,
  onDone,
}: {
  event: LogicEvent
  onChange: (e: LogicEvent) => void
  onDone: () => void
}) {
  const conditions = event.conditions ?? []

  return (
    <div className="p-3 bg-[#0E1626] border-t border-[#1A253A] space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-[#00FFFF]">
        Edit Logic Event
      </div>

      {/* trigger */}
      <div className="flex items-center gap-3">
        <span className={`${lbl} w-20`}>Trigger</span>
        <select
          className={sel}
          value={event.trigger.type}
          onChange={(e) =>
            onChange({
              ...event,
              trigger: defaultTrigger(
                e.target.value as LogicTrigger['type'],
              ),
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

      {/* conditions */}
      <div className="flex items-start gap-3">
        <span className={`${lbl} w-20 pt-2`}>Conditions</span>
        <div className="flex-1 space-y-1.5">
          {conditions.length === 0 && (
            <div className="text-[11px] text-[#5b6b82]">
              no conditions — event always proceeds (AND of all conditions)
            </div>
          )}
          {conditions.map((c, i) => (
            <ConditionRow
              key={i}
              cond={c}
              onChange={(nc) => {
                const next = conditions.slice()
                next[i] = nc
                onChange({ ...event, conditions: next })
              }}
              onRemove={() =>
                onChange({
                  ...event,
                  conditions: conditions.filter((_, j) => j !== i),
                })
              }
            />
          ))}
          <button
            className={link}
            onClick={() =>
              onChange({
                ...event,
                conditions: [...conditions, defaultCondition('compareVariable')],
              })
            }
          >
            ＋ add condition
          </button>
        </div>
      </div>

      {/* actions */}
      <div className="flex items-start gap-3">
        <span className={`${lbl} w-20 pt-2`}>Actions</span>
        <div className="flex-1 space-y-1.5">
          {event.actions.length === 0 && (
            <div className="text-[11px] text-[#5b6b82]">no actions yet</div>
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
          className="px-3 py-1.5 rounded text-xs font-semibold bg-[#062a2a] border border-[#0a5a5a] text-[#00FFFF]"
          onClick={onDone}
        >
          ✓ Done
        </button>
      </div>
    </div>
  )
}
