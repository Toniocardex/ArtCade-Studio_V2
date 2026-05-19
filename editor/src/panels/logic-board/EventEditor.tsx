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
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const inp =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] uppercase tracking-wider text-[var(--muted)]'
const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'

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
  if (trigger.type === 'onTriggerEnter' || trigger.type === 'onTriggerExit')
    return (
      <span className="flex items-center gap-2">
        <span className={lbl}>with class</span>
        <Txt
          value={trigger.withClass ?? ''}
          placeholder="Zone"
          onChange={(s) => onChange({ ...trigger, withClass: s })}
        />
      </span>
    )
  if (trigger.type === 'onAnimationEnd')
    return (
      <span className="flex items-center gap-2">
        <span className={lbl}>clip</span>
        <Txt
          value={trigger.clipName ?? ''}
          placeholder="death (engine hook pending)"
          onChange={(s) => onChange({ type: 'onAnimationEnd', clipName: s })}
        />
      </span>
    )
  if (trigger.type === 'onMouseInput')
    return (
      <span className="flex items-center gap-2">
        <span className={lbl}>button</span>
        <select
          className={sel}
          value={trigger.button}
          onChange={(e) =>
            onChange({ ...trigger, button: e.target.value as typeof trigger.button })
          }
        >
          <option value="left">left</option>
          <option value="right">right</option>
        </select>
        <select
          className={sel}
          value={trigger.eventType}
          onChange={(e) =>
            onChange({ ...trigger, eventType: e.target.value as typeof trigger.eventType })
          }
        >
          {INPUT_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </span>
    )
  if (trigger.type === 'onMessage')
    return (
      <span className="flex items-center gap-2">
        <span className={lbl}>message</span>
        <Txt
          w="w-40"
          value={trigger.messageName}
          placeholder="player_hit"
          onChange={(s) => onChange({ type: 'onMessage', messageName: s })}
        />
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
        <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
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
    <div className="flex items-center gap-2 bg-[var(--panel)] border border-[var(--border)] rounded px-2 py-1.5">
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
      {cond.type === 'hasTag' && (
        <Txt
          value={cond.tag}
          placeholder="enemy"
          onChange={(s) => onChange({ ...cond, tag: s })}
        />
      )}
      {cond.type === 'compareDistance' && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker
            value={cond.target}
            onChange={(t) => onChange({ ...cond, target: t })}
          />
          <select
            className={sel}
            value={cond.operator}
            onChange={(e) =>
              onChange({ ...cond, operator: e.target.value as (typeof COMPARISON_OPS)[number] })
            }
          >
            {COMPARISON_OPS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <Num value={cond.value} onChange={(n) => onChange({ ...cond, value: n })} />
        </>
      )}
      {cond.type === 'isMouseOver' && (
        <>
          <span className={lbl}>radius</span>
          <Num
            value={cond.radius ?? 32}
            onChange={(n) => onChange({ ...cond, radius: n })}
          />
        </>
      )}
      {cond.type === 'raycastHit' && (
        <>
          <span className={lbl}>dir</span>
          <Num value={cond.dirX} onChange={(n) => onChange({ ...cond, dirX: n })} />
          <Num value={cond.dirY} onChange={(n) => onChange({ ...cond, dirY: n })} />
          <span className={lbl}>len</span>
          <Num value={cond.length} onChange={(n) => onChange({ ...cond, length: n })} />
          <span className={lbl}>class</span>
          <Txt
            w="w-24"
            value={cond.className ?? ''}
            placeholder="(any)"
            onChange={(s) => onChange({ ...cond, className: s })}
          />
        </>
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
            <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
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
      {act.type === 'setGlobalState' && (
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
      {act.type === 'emitEvent' && (
        <>
          <span className={lbl}>name</span>
          <Txt w="w-28" value={act.name} onChange={(s) => onChange({ ...act, name: s })} />
          <span className={lbl}>payload</span>
          <Txt
            w="w-20"
            value={act.payloadKey ?? ''}
            placeholder="key"
            onChange={(s) => onChange({ ...act, payloadKey: s })}
          />
          <Txt
            w="w-20"
            value={String(act.payloadValue ?? '')}
            placeholder="value"
            onChange={(s) =>
              onChange({
                ...act,
                payloadValue: s !== '' && !isNaN(Number(s)) ? Number(s) : s,
              })
            }
          />
        </>
      )}
      {act.type === 'toggleLogicEvent' && (
        <>
          <span className={lbl}>event id</span>
          <Txt
            w="w-32"
            value={act.eventId}
            placeholder="evt_123"
            onChange={(s) => onChange({ ...act, eventId: s })}
          />
          <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={act.enabled}
              onChange={(e) => onChange({ ...act, enabled: e.target.checked })}
            />
            enabled
          </label>
        </>
      )}
      {(act.type === 'applyImpulse' || act.type === 'applyForce') && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker value={act.target} onChange={(t) => onChange({ ...act, target: t })} />
          {act.type === 'applyImpulse' ? (
            <>
              <span className={lbl}>ix</span>
              <Num value={act.ix} onChange={(n) => onChange({ ...act, ix: n })} />
              <span className={lbl}>iy</span>
              <Num value={act.iy} onChange={(n) => onChange({ ...act, iy: n })} />
            </>
          ) : (
            <>
              <span className={lbl}>fx</span>
              <Num value={act.fx} onChange={(n) => onChange({ ...act, fx: n })} />
              <span className={lbl}>fy</span>
              <Num value={act.fy} onChange={(n) => onChange({ ...act, fy: n })} />
            </>
          )}
        </>
      )}
      {act.type === 'setRotation' && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker value={act.target} onChange={(t) => onChange({ ...act, target: t })} />
          <span className={lbl}>angle</span>
          <Num value={act.angle} onChange={(n) => onChange({ ...act, angle: n })} />
        </>
      )}
      {act.type === 'setScale' && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker value={act.target} onChange={(t) => onChange({ ...act, target: t })} />
          <span className={lbl}>sx</span>
          <Num value={act.scaleX} onChange={(n) => onChange({ ...act, scaleX: n })} />
          <span className={lbl}>sy</span>
          <Num value={act.scaleY} onChange={(n) => onChange({ ...act, scaleY: n })} />
        </>
      )}
      {act.type === 'setVisible' && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker value={act.target} onChange={(t) => onChange({ ...act, target: t })} />
          <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={act.visible}
              onChange={(e) => onChange({ ...act, visible: e.target.checked })}
            />
            visible
          </label>
        </>
      )}
      {act.type === 'setColorTint' && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker value={act.target} onChange={(t) => onChange({ ...act, target: t })} />
          <input
            type="color"
            value={act.hexColor || '#ffffff'}
            onChange={(e) => onChange({ ...act, hexColor: e.target.value })}
            className="w-7 h-6 bg-transparent border border-[var(--border-2)] rounded"
          />
          <span className={lbl}>alpha</span>
          <Num value={act.alpha ?? 1} onChange={(n) => onChange({ ...act, alpha: n })} />
        </>
      )}
      {act.type === 'loadScene' && (
        <>
          <span className={lbl}>scene</span>
          <Txt w="w-40" value={act.sceneName} placeholder="level_2"
               onChange={(s) => onChange({ ...act, sceneName: s })} />
        </>
      )}
      {act.type === 'setCameraTarget' && (
        <>
          <span className={lbl}>target</span>
          <TargetPicker value={act.target} onChange={(t) => onChange({ ...act, target: t })} />
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
    <div className="p-3 bg-[var(--panel-3)] border-t border-[var(--border)] space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--accent)]">
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
            <div className="text-[11px] text-[var(--muted-2)]">
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
