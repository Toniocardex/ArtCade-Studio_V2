// ---------------------------------------------------------------------------
// Flat (AND list) vs tree (conditionRoot OR/AND) condition authoring
// ---------------------------------------------------------------------------

import type { LogicCondition, LogicConditionNode, LogicEvent } from '../../types/logic-board'
import { defaultConditionRoot } from '../../utils/logic-board/schema-registry'
import { CONDITION_TYPES, defaultCondition } from '../../panels/logic-board/options'
import { SchemaParamForm } from './SchemaParamForm'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] uppercase tracking-wider text-[var(--muted)]'
const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'
const panel =
  'bg-[var(--panel)] border border-[var(--border)] rounded px-2 py-1.5 ml-2'

export type ConditionMode = 'flat' | 'tree'

export function getConditionMode(event: LogicEvent): ConditionMode {
  return event.conditionRoot != null ? 'tree' : 'flat'
}

function NodeEditor({
  node,
  path,
  onChange,
  onRemove,
  depth,
}: {
  node: LogicConditionNode
  path: string
  onChange: (n: LogicConditionNode) => void
  onRemove?: () => void
  depth: number
}) {
  if (node.kind === 'leaf') {
    const cond = node.condition
    return (
      <div className={`${panel} flex items-center flex-wrap gap-2`} style={{ marginLeft: depth * 12 }}>
        <span className={lbl}>leaf</span>
        <select
          className={sel}
          value={cond.type}
          onChange={(e) =>
            onChange({
              kind: 'leaf',
              condition: defaultCondition(e.target.value as LogicCondition['type']),
            })
          }
        >
          {CONDITION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <SchemaParamForm
          kind="condition"
          type={cond.type}
          value={cond as unknown as Record<string, unknown>}
          onChange={(next) =>
            onChange({ kind: 'leaf', condition: next as LogicCondition })
          }
        />
        {onRemove && (
          <button className={link} onClick={onRemove} title="remove">
            ✕
          </button>
        )}
      </div>
    )
  }

  const group = node
  return (
    <div className="flex flex-col gap-1" style={{ marginLeft: depth * 12 }}>
      <div className={`${panel} flex items-center flex-wrap gap-2`}>
        <span className={lbl}>group</span>
        <select
          className={sel}
          value={group.operator}
          onChange={(e) =>
            onChange({
              ...group,
              operator: e.target.value as 'AND' | 'OR',
            })
          }
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
        <button
          className={link}
          type="button"
          onClick={() =>
            onChange({
              ...group,
              statements: [
                ...group.statements,
                {
                  kind: 'leaf',
                  condition: defaultCondition('compareVariable'),
                },
              ],
            })
          }
        >
          + leaf
        </button>
        <button
          className={link}
          type="button"
          onClick={() =>
            onChange({
              ...group,
              statements: [
                ...group.statements,
                {
                  kind: 'group',
                  operator: 'AND',
                  statements: [
                    {
                      kind: 'leaf',
                      condition: defaultCondition('compareVariable'),
                    },
                  ],
                },
              ],
            })
          }
        >
          + subgroup
        </button>
        {onRemove && (
          <button className={link} onClick={onRemove} title="remove">
            ✕
          </button>
        )}
      </div>
      {group.statements.map((child, i) => (
        <NodeEditor
          key={`${path}-${i}`}
          node={child}
          path={`${path}/${i}`}
          depth={depth + 1}
          onChange={(next) => {
            const statements = group.statements.slice()
            statements[i] = next
            onChange({ ...group, statements })
          }}
          onRemove={() => {
            const statements = group.statements.filter((_, j) => j !== i)
            onChange({ ...group, statements })
          }}
        />
      ))}
    </div>
  )
}

export function ConditionTreeEditor({
  event,
  onChange,
}: {
  event: LogicEvent
  onChange: (e: LogicEvent) => void
}) {
  const mode = getConditionMode(event)

  function setMode(next: ConditionMode) {
    if (next === mode) return
    if (next === 'tree') {
      onChange({
        ...event,
        conditionRoot: event.conditionRoot ?? defaultConditionRoot(),
        conditions: undefined,
      })
    } else {
      const { conditionRoot: _r, ...rest } = event
      onChange({
        ...rest,
        conditions: event.conditions?.length
          ? event.conditions
          : [defaultCondition('compareVariable')],
      })
    }
  }

  const conditions = event.conditions ?? []

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={lbl}>mode</span>
        <select className={sel} value={mode} onChange={(e) => setMode(e.target.value as ConditionMode)}>
          <option value="flat">Flat (AND list)</option>
          <option value="tree">Tree (OR / AND)</option>
        </select>
      </div>

      {mode === 'flat' && (
        <>
          {conditions.length === 0 && (
            <p className="text-[10px] text-[var(--muted)] italic">
              no conditions — event always proceeds
            </p>
          )}
          {conditions.map((c, i) => (
            <div
              key={i}
              className={`${panel} flex items-center flex-wrap gap-2 ml-0`}
            >
              <select
                className={sel}
                value={c.type}
                onChange={(e) => {
                  const next = conditions.slice()
                  next[i] = defaultCondition(e.target.value as LogicCondition['type'])
                  onChange({ ...event, conditions: next })
                }}
              >
                {CONDITION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <SchemaParamForm
                kind="condition"
                type={c.type}
                value={c as unknown as Record<string, unknown>}
                onChange={(next) => {
                  const nextList = conditions.slice()
                  nextList[i] = next as LogicCondition
                  onChange({ ...event, conditions: nextList })
                }}
              />
              <button
                className={link}
                onClick={() =>
                  onChange({
                    ...event,
                    conditions: conditions.filter((_, j) => j !== i),
                  })
                }
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className={link}
            type="button"
            onClick={() =>
              onChange({
                ...event,
                conditions: [...conditions, defaultCondition('compareVariable')],
              })
            }
          >
            + condition
          </button>
        </>
      )}

      {mode === 'tree' && event.conditionRoot && (
        <NodeEditor
          node={event.conditionRoot}
          path="root"
          depth={0}
          onChange={(root) => onChange({ ...event, conditions: undefined, conditionRoot: root })}
        />
      )}
    </div>
  )
}
