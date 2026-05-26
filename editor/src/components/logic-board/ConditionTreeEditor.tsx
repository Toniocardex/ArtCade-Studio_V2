// ---------------------------------------------------------------------------
// Advanced condition tree (AND / OR groups) — shown only when user opts in
// ---------------------------------------------------------------------------

import type { LogicCondition, LogicConditionNode, LogicEvent } from '../../types/logic-board'
import type { ConditionCombineOp } from '../../utils/logic-board/condition-combine'
import { ConditionCombineSelect } from './ConditionCombineSelect'
import { ConditionPolaritySelect } from './ConditionPolaritySelect'
import { defaultConditionRoot } from '../../utils/logic-board/schema-registry'
import { CONDITION_TYPES, defaultCondition } from '../../panels/logic-board/options'
import { SchemaParamForm } from './SchemaParamForm'
import { TypePicker } from './TypePicker'

const lbl = 'text-[10px] font-medium text-[var(--muted)]'
const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'
const panel =
  'bg-[var(--panel)] border border-[var(--border)] rounded px-2 py-1.5'

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
  conditionTypes,
  recommendedConditionTypes,
}: {
  node: LogicConditionNode
  path: string
  onChange: (n: LogicConditionNode) => void
  onRemove?: () => void
  depth: number
  conditionTypes: readonly LogicCondition['type'][]
  recommendedConditionTypes?: readonly LogicCondition['type'][]
}) {
  if (node.kind === 'leaf') {
    const cond = node.condition
    return (
      <div
        className={`${panel} flex items-center flex-wrap gap-2`}
        style={{ marginLeft: depth * 12 }}
      >
        <ConditionPolaritySelect
          negated={node.negated}
          onChange={(negated) =>
            onChange({
              kind: 'leaf',
              condition: cond,
              negated: negated || undefined,
            })
          }
        />
        <span className={lbl}>Check</span>
        <TypePicker
          kind="condition"
          types={conditionTypes}
          recommendedTypes={recommendedConditionTypes}
          value={cond.type}
          onChange={(t) =>
            onChange({
              kind: 'leaf',
              condition: defaultCondition(t as LogicCondition['type']),
              negated: node.negated,
            })
          }
          className="max-w-[200px]"
        />
        <SchemaParamForm
          kind="condition"
          type={cond.type}
          value={cond as unknown as Record<string, unknown>}
          onChange={(next) =>
            onChange({
              kind: 'leaf',
              condition: next as LogicCondition,
              negated: node.negated,
            })
          }
        />
        {onRemove && (
          <button type="button" className={link} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    )
  }

  const group = node
  return (
    <div className="flex flex-col gap-1" style={{ marginLeft: depth * 12 }}>
      <div className={`${panel} flex items-center flex-wrap gap-2`}>
        <span className={lbl}>Group</span>
        <ConditionCombineSelect
          value={group.operator}
          aria-label="Group match rules"
          onChange={(operator: ConditionCombineOp) =>
            onChange({
              ...group,
              operator,
            })
          }
        />
        <button
          type="button"
          className={link}
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
          + Add check
        </button>
        <button
          type="button"
          className={link}
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
          + Add group
        </button>
        {onRemove && (
          <button type="button" className={link} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      {group.statements.map((child, i) => (
        <NodeEditor
          key={`${path}-${i}`}
          node={child}
          path={`${path}/${i}`}
          depth={depth + 1}
          conditionTypes={conditionTypes}
          recommendedConditionTypes={recommendedConditionTypes}
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

/** Tree-only editor for advanced mode. */
export function ConditionTreeEditor({
  event,
  onChange,
  advanced = false,
  conditionTypes = CONDITION_TYPES,
  recommendedConditionTypes: recommendedTypes,
}: {
  event: LogicEvent
  onChange: (e: LogicEvent) => void
  advanced?: boolean
  conditionTypes?: readonly LogicCondition['type'][]
  recommendedConditionTypes?: readonly LogicCondition['type'][]
}) {
  if (!advanced) return null

  const root = event.conditionRoot ?? defaultConditionRoot()

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-[var(--muted)]">
        Nested groups: use when you need (A and B) or C. For simple OR between
        checks, use simple Also require… with &quot;Any can pass&quot; instead.
      </p>
      <NodeEditor
        node={root}
        path="root"
        depth={0}
        conditionTypes={conditionTypes}
        recommendedConditionTypes={recommendedTypes}
        onChange={(r) => onChange({ ...event, conditions: undefined, conditionRoot: r })}
      />
    </div>
  )
}
