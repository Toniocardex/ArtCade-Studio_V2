// ---------------------------------------------------------------------------
// Advanced condition tree (AND / OR groups) — shown only when user opts in
// ---------------------------------------------------------------------------

import type { LogicCondition, LogicConditionNode, LogicEvent } from '../../types/logic-board'
import type { ConditionCombineOp } from '../../utils/logic-board/condition-combine'
import { ConditionCombineSelect } from './ConditionCombineSelect'
import { ConditionPolaritySelect } from './ConditionPolaritySelect'
import { defaultConditionRoot } from '../../utils/logic-board/schema-registry'
import { CONDITION_TYPES, defaultCondition } from '../../panels/logic-board/options'
import { conditionDisplayName } from '../../panels/logic-board/friendly-labels'
import { CatalogSelectButton } from './CatalogSelectButton'
import { conditionCatalogText } from './catalog-copy'
import { SchemaParamForm } from './SchemaParamForm'

const lbl = 'text-[10px] font-medium text-[var(--muted)]'
const link = 'text-[var(--muted)] text-[11px] underline underline-offset-2 hover:text-[var(--text)] cursor-pointer'
const pickerButton =
  'inline-flex max-w-[200px] items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] hover:border-[var(--accent-bd)]'
const panel =
  'bg-[var(--panel)] border border-[var(--border)] rounded px-2 py-1.5'

export type ConditionMode = 'flat' | 'tree'

export function getConditionMode(event: LogicEvent): ConditionMode {
  return event.conditionRoot == null ? 'flat' : 'tree'
}

type NodeEditorProps = Readonly<{
  node: LogicConditionNode
  path: string
  onChange: (n: LogicConditionNode) => void
  onRemove?: () => void
  depth: number
  conditionTypes: readonly LogicCondition['type'][]
  recommendedConditionTypes?: readonly LogicCondition['type'][]
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
}>

function NodeEditor({
  node,
  path,
  onChange,
  onRemove,
  depth,
  conditionTypes,
  recommendedConditionTypes,
  contextSpritePath,
  ambiguousTargetSpritePaths,
}: NodeEditorProps) {
  if (node.kind === 'leaf') {
    const cond = node.condition
    const changeText = conditionCatalogText('change')
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
        <CatalogSelectButton
          kind="condition"
          label={conditionDisplayName(cond.type)}
          buttonTitle="Change check"
          buttonClassName={pickerButton}
          title={changeText.title}
          subtitle={changeText.subtitle}
          searchPlaceholder={changeText.searchPlaceholder}
          types={conditionTypes}
          recommendedTypes={recommendedConditionTypes}
          onPick={(t) =>
            onChange({
              kind: 'leaf',
              condition: defaultCondition(t as LogicCondition['type']),
              negated: node.negated,
            })
          }
        />
        <SchemaParamForm
          kind="condition"
          type={cond.type}
          value={cond}
          onChange={(next) =>
            onChange({
              kind: 'leaf',
              condition: next as LogicCondition,
              negated: node.negated,
            })
          }
          contextSpritePath={contextSpritePath}
          ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
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
  const addText = conditionCatalogText('add')
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
        <CatalogSelectButton
          kind="condition"
          label="+ Add check"
          buttonTitle="Browse the check catalog"
          buttonClassName={link}
          title={addText.title}
          subtitle={addText.subtitle}
          searchPlaceholder={addText.searchPlaceholder}
          types={conditionTypes}
          recommendedTypes={recommendedConditionTypes}
          onPick={(t) =>
            onChange({
              ...group,
              statements: [
                ...group.statements,
                {
                  kind: 'leaf',
                  condition: defaultCondition(t as LogicCondition['type']),
                },
              ],
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
                  kind: 'group',
                  operator: 'AND',
                  statements: [
                    {
                      kind: 'leaf',
                      condition: defaultCondition('compareValues'),
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
          contextSpritePath={contextSpritePath}
          ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
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

export type ConditionTreeEditorProps = Readonly<{
  event: LogicEvent
  onChange: (e: LogicEvent) => void
  advanced?: boolean
  conditionTypes?: readonly LogicCondition['type'][]
  recommendedConditionTypes?: readonly LogicCondition['type'][]
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
}>

/** Tree-only editor for advanced mode. */
export function ConditionTreeEditor({
  event,
  onChange,
  advanced = false,
  conditionTypes = CONDITION_TYPES,
  recommendedConditionTypes: recommendedTypes,
  contextSpritePath,
  ambiguousTargetSpritePaths,
}: ConditionTreeEditorProps) {
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
        contextSpritePath={contextSpritePath}
        ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
        onChange={(r) => onChange({ ...event, conditions: undefined, conditionRoot: r })}
      />
    </div>
  )
}
