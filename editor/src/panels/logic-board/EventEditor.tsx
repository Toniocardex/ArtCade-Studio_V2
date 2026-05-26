// ---------------------------------------------------------------------------
// Expanded rule editor - When / Also require… / Then blocks
// ---------------------------------------------------------------------------

import { Fragment, useState } from 'react'
import {
  Check,
  Copy,
  GitBranch,
  ListChecks,
  Split,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react'
import type {
  LogicAction,
  LogicCondition,
  LogicEvent,
  LogicTrigger,
} from '../../types/logic-board'
import { LogicBlock } from '../../components/logic-board/LogicBlock'
import { TypePicker } from '../../components/logic-board/TypePicker'
import { SchemaParamForm } from '../../components/logic-board/SchemaParamForm'
import { ConditionCombineSelect } from '../../components/logic-board/ConditionCombineSelect'
import { ConditionPolaritySelect } from '../../components/logic-board/ConditionPolaritySelect'
import { ConditionTreeEditor } from '../../components/logic-board/ConditionTreeEditor'
import type { ConditionCombineOp } from '../../utils/logic-board/condition-combine'
import { OnInputTriggerFields } from '../../components/logic-board/OnInputTriggerFields'
import { defaultConditionRoot } from '../../utils/logic-board/schema-registry'
import { actionDisplayName } from './friendly-labels'
import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import {
  actionRequirement,
  conditionRequirement,
  recommendedActionTypes,
  triggerRequirement,
  type CapabilityRequirement,
} from '../../utils/logic-board/component-capabilities'
import {
  allowedTriggersForTarget,
  eventCompatibilityError,
} from '../../utils/logic-board/trigger-compatibility'
import {
  conditionTypesForTrigger,
  conditionTypesInUse,
  recommendedConditionTypes,
} from '../../utils/logic-board/condition-picker'
import { useEditor } from '../../store/editor-store'
import type { AuthoringMode } from '../../types/authoring-mode'
import LogicIconButton from '../../components/logic-board/LogicIconButton'
import { cloneLogicAction } from '../../utils/logic-board/clone'
import { eventHasConditionBlock } from '../../utils/logic-board/event-conditions'
import {
  ACTION_TYPES,
  defaultAction,
  defaultCondition,
  defaultTrigger,
  TRIGGER_TYPES,
} from './options'

const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'
const btn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] hover:border-[var(--accent-bd)]'
const btnDisabled =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border-2)] bg-[var(--border)] text-[var(--muted)] opacity-50 cursor-not-allowed'

/** Sentinel for the Then-row action picker before the user chooses a type. */
const NEW_ACTION_NONE = '' as const
type NewActionPick = LogicAction['type'] | typeof NEW_ACTION_NONE

function hasMovementAction(actions: readonly LogicAction[]): boolean {
  return actions.some((action) => action.type === 'controllerMovement')
}

function actionFitsTrigger(actionType: LogicAction['type'], trigger: LogicTrigger): boolean {
  if (actionType !== 'controllerMovement') return true
  return trigger.type === 'onInput' && trigger.eventType === 'down'
}

function recommendedTypesForTrigger(
  types: readonly LogicAction['type'][],
  trigger: LogicTrigger,
): LogicAction['type'][] {
  return types.filter((type) => actionFitsTrigger(type, trigger))
}

function withContextualInputDefault(
  event: LogicEvent,
  actions: LogicAction[],
): LogicEvent {
  if (event.trigger.type !== 'onInput') return { ...event, actions }
  if (!hasMovementAction(actions)) return { ...event, actions }
  return {
    ...event,
    trigger: { ...event.trigger, eventType: 'down' },
    actions,
  }
}

function TriggerFields({
  trigger,
  board,
  project,
  onChange,
}: {
  trigger: LogicTrigger
  board?: LogicBoard | null
  project?: ProjectDoc | null
  onChange: (t: LogicTrigger) => void
}) {
  const isSensorTrigger =
    trigger.type === 'onTriggerEnter' || trigger.type === 'onTriggerExit'
  const isCollisionTrigger =
    trigger.type === 'onCollision' ||
    trigger.type === 'onCollisionEnter' ||
    trigger.type === 'onCollisionExit'

  return (
    <>
      {trigger.type === 'onInput' ? (
        <OnInputTriggerFields
          trigger={trigger}
          onChange={(t) => onChange(t)}
        />
      ) : (
        <SchemaParamForm
          kind="trigger"
          type={trigger.type}
          value={trigger as unknown as Record<string, unknown>}
          onChange={(next) => onChange(next as LogicTrigger)}
        />
      )}
      {isCollisionTrigger && (
        <p className="text-[10px] leading-snug text-[var(--muted)]">
          Requires Box2D overlap: add <strong>Physics (Box2D Body)</strong> on this entity
          (platformer/top-down alone is not enough). Arcade without physics: use{' '}
          <strong>Sensor</strong> (onTriggerEnter/Exit) or <strong>onMessage</strong>.
        </p>
      )}
      {isSensorTrigger && (
        <p className="text-[10px] leading-snug text-[var(--muted)]">
          Target tag must match <code className="text-[var(--text)]">SensorComponent.targetTag</code>{' '}
          on the zone entity (Inspector - Sensor). Leave empty to accept any tag.
        </p>
      )}
      <ComponentRequirementWarning requirement={triggerRequirement(trigger, project, board)} />
    </>
  )
}

function ComponentRequirementWarning({
  requirement,
}: {
  requirement: CapabilityRequirement | null
}) {
  if (!requirement) return null
  return (
    <p className="w-full text-[10px] leading-snug text-[var(--warn)]">
      {requirement.message}
    </p>
  )
}

function ActionListBlock({
  actions,
  board,
  project,
  recommendedTypes,
  onChangeActions,
  newActionType,
  setNewActionType,
  emptyHint,
}: {
  actions: LogicAction[]
  board?: LogicBoard | null
  project?: ProjectDoc | null
  recommendedTypes: readonly string[]
  onChangeActions: (actions: LogicAction[]) => void
  newActionType: NewActionPick
  setNewActionType: (t: NewActionPick) => void
  emptyHint: string
}) {
  return (
    <>
      {actions.length === 0 && (
        <p className="text-[11px] text-[var(--muted)]">{emptyHint}</p>
      )}
      {actions.map((a, i) => (
        <ActionCard
          key={i}
          act={a}
          board={board}
          project={project}
          recommendedTypes={recommendedTypes}
          onChange={(na) => {
            const next = actions.slice()
            next[i] = na
            onChangeActions(next)
          }}
          onRemove={() => onChangeActions(actions.filter((_, j) => j !== i))}
          onClone={() => {
            const next = actions.slice()
            next.splice(i + 1, 0, cloneLogicAction(a))
            onChangeActions(next)
          }}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <TypePicker
          kind="action"
          types={ACTION_TYPES}
          value={newActionType}
          onChange={(t) => setNewActionType(t as LogicAction['type'])}
          className="max-w-[240px]"
          recommendedTypes={recommendedTypes}
          placeholder="Select action…"
          placeholderValue={NEW_ACTION_NONE}
        />
        <button
          type="button"
          className={newActionType ? btn : btnDisabled}
          disabled={!newActionType}
          title={
            newActionType
              ? 'Add the selected action'
              : 'Choose an action from the list first'
          }
          onClick={() => {
            if (!newActionType) return
            const next = [...actions, defaultAction(newActionType)]
            onChangeActions(next)
            setNewActionType(NEW_ACTION_NONE)
          }}
        >
          <Plus size={13} />
          Add action
        </button>
      </div>
    </>
  )
}

function ActionCard({
  act,
  board,
  project,
  recommendedTypes,
  onChange,
  onClone,
  onRemove,
}: {
  act: LogicAction
  board?: LogicBoard | null
  project?: ProjectDoc | null
  recommendedTypes: readonly string[]
  onChange: (a: LogicAction) => void
  onClone: () => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded border border-[var(--border)] bg-[var(--bg)] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <TypePicker
          kind="action"
          types={ACTION_TYPES}
          value={act.type}
          onChange={(t) => onChange(defaultAction(t as LogicAction['type']))}
          className="max-w-[220px]"
          recommendedTypes={recommendedTypes}
        />
        <span className="text-[10px] text-[var(--muted)]">
          {actionDisplayName(act.type)}
        </span>
        <div className="flex-1" />
        <LogicIconButton
          title="Clona azione"
          ariaLabel="Clona azione"
          onClick={onClone}
        >
          <Copy size={13} />
        </LogicIconButton>
        <LogicIconButton
          title="Rimuovi azione"
          ariaLabel="Rimuovi azione"
          danger
          onClick={onRemove}
        >
          <Trash2 size={13} />
        </LogicIconButton>
      </div>
      <SchemaParamForm
        kind="action"
        type={act.type}
        value={act as unknown as Record<string, unknown>}
        onChange={(next) => onChange(next as LogicAction)}
      />
      <ComponentRequirementWarning requirement={actionRequirement(act, project, board)} />
      {act.type === 'spawnEntity' && (
        <p className="text-[10px] text-[var(--muted)]">
          Creates an object at fixed coordinates or a chosen attachment point.
        </p>
      )}
      {act.type === 'spawnEntityAtPointer' && (
        <p className="text-[10px] text-[var(--muted)]">
          Creates an object where the pointer is.
        </p>
      )}
    </div>
  )
}

const condSel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'

function AlsoRequireSectionHints({
  onlyIfEnabled,
  trigger,
  authoringMode,
}: {
  onlyIfEnabled: boolean
  trigger: LogicTrigger
  authoringMode: AuthoringMode
}) {
  if (authoringMode === 'advanced') {
    if (!onlyIfEnabled) return null
    return (
      <p className="text-[10px] leading-snug text-[var(--muted)]">
        World-state filters after <strong>When</strong> (grounded, score, …).
      </p>
    )
  }
  if (!onlyIfEnabled) {
    return (
      <p className="text-[10px] leading-snug text-[var(--muted)]">
        Optional — turn on for extra checks beyond <strong>When</strong>. Includes{' '}
        <strong>AND | OR | NOT</strong> (Match rules) and <strong>Pass / NOT</strong> per
        check.
      </p>
    )
  }
  if (trigger.type === 'onInput') {
    return (
      <p className="text-[10px] leading-snug text-[var(--muted)]">
        Key combos (W <strong>and</strong> Ctrl) or alternatives (W <strong>or</strong>{' '}
        Space) belong in <strong>When</strong>. Use <strong>Also require…</strong> for
        grounded, score, touching type — not extra keys. Use <strong>Match rules</strong>{' '}
        and row <strong>NOT</strong> for inversion.
      </p>
    )
  }
  return (
    <p className="text-[10px] leading-snug text-[var(--muted)]">
      Extra checks beyond <strong>When</strong> — <strong>Match rules</strong>: AND, OR,
      or NOT; each row can be Pass or NOT.
    </p>
  )
}

function SimpleConditions({
  event,
  board,
  project,
  onChange,
  conditionTypes,
  recommendedConditions,
}: {
  event: LogicEvent
  board?: LogicBoard | null
  project?: ProjectDoc | null
  onChange: (e: LogicEvent) => void
  conditionTypes: readonly LogicCondition['type'][]
  recommendedConditions: readonly LogicCondition['type'][]
}) {
  const conditions = event.conditions ?? []
  const combineOp = event.conditionsOperator ?? 'AND'

  return (
    <div className="space-y-2">
      {conditions.length === 0 && (
        <p className="text-[11px] italic text-[var(--muted)]">
          Also require… is on, but no checks have been added yet.
        </p>
      )}
      {conditions.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div className="flex flex-wrap items-center gap-2 py-0.5 pl-1">
              <ConditionCombineSelect
                className={condSel}
                value={combineOp}
                aria-label="Combine checks"
                onChange={(op: ConditionCombineOp) =>
                  onChange({
                    ...event,
                    conditionsOperator: op,
                    conditionRoot: undefined,
                  })
                }
              />
            </div>
          )}
        <div
          className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
        >
          <ConditionPolaritySelect
            negated={c.negated}
            onChange={(negated) => {
              const conds = conditions.slice()
              conds[i] = { ...c, negated: negated || undefined }
              onChange({ ...event, conditions: conds, conditionRoot: undefined })
            }}
          />
          <TypePicker
            kind="condition"
            types={conditionTypes}
            recommendedTypes={recommendedConditions}
            value={c.type}
            onChange={(t) => {
              const next = conditions.slice()
              next[i] = {
                ...defaultCondition(t as LogicCondition['type']),
                negated: c.negated,
              }
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
              conds[i] = { ...(next as LogicCondition), negated: c.negated }
              onChange({ ...event, conditions: conds, conditionRoot: undefined })
            }}
          />
          <ComponentRequirementWarning requirement={conditionRequirement(c, project, board)} />
          <button
            type="button"
            className={link}
            onClick={() =>
              onChange({
                ...event,
                onlyIfEnabled: true,
                conditions: conditions.filter((_, j) => j !== i),
              })
            }
          >
            Remove
          </button>
        </div>
        </Fragment>
      ))}
      {conditions.length === 1 && (
        <div className="flex flex-wrap items-center gap-2 py-0.5 pl-1">
          <span className="text-[10px] text-[var(--muted)]">Combine</span>
          <ConditionCombineSelect
            className={condSel}
            value={combineOp}
            aria-label="Combine checks"
            onChange={(op: ConditionCombineOp) =>
              onChange({
                ...event,
                conditionsOperator: op,
                conditionRoot: undefined,
              })
            }
          />
          <span className="text-[10px] text-[var(--muted)]">
            Use NOT to invert this single check.
          </span>
        </div>
      )}
      <button
        type="button"
        className={link}
        onClick={() =>
          onChange({
            ...event,
            onlyIfEnabled: true,
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
  board,
  project,
  onChange,
  onDone,
}: {
  event: LogicEvent
  board?: LogicBoard | null
  project?: ProjectDoc | null
  onChange: (e: LogicEvent) => void
  onDone: () => void
}) {
  const { state } = useEditor()
  const authoringMode = state.authoringMode
  const [advancedConditions, setAdvancedConditions] = useState(
    () => event.conditionRoot != null,
  )
  const [newActionType, setNewActionType] = useState<NewActionPick>(NEW_ACTION_NONE)
  const [newElseActionType, setNewElseActionType] =
    useState<NewActionPick>(NEW_ACTION_NONE)
  const recommendedTypes = recommendedTypesForTrigger(
    recommendedActionTypes(project, board),
    event.trigger,
  )
  const triggerTypes = board
    ? allowedTriggersForTarget(board.target.type)
    : TRIGGER_TYPES
  const compatError = board ? eventCompatibilityError(event, board.target.type) : null
  const hasSavedConditions =
    event.conditionRoot != null || (event.conditions?.length ?? 0) > 0
  const onlyIfEnabled =
    event.onlyIfEnabled ?? hasSavedConditions
  const canUseElse = onlyIfEnabled && eventHasConditionBlock(event)
  const elseEnabled = event.elseEnabled === true && canUseElse

  const setOnlyIfEnabled = (enabled: boolean) => {
    onChange({
      ...event,
      onlyIfEnabled: enabled,
      ...(enabled
        ? {}
        : {
            elseEnabled: false,
            elseActions: undefined,
          }),
    })
  }

  const setElseEnabled = (enabled: boolean) => {
    onChange({
      ...event,
      elseEnabled: enabled,
      elseActions: enabled
        ? event.elseActions?.length
          ? event.elseActions
          : []
        : undefined,
    })
  }

  const typesInUse = conditionTypesInUse(event)
  const pickerConditionTypes = conditionTypesForTrigger(
    event.trigger,
    undefined,
    authoringMode,
    typesInUse,
  )
  const pickerRecommendedConditions = recommendedConditionTypes(
    event.trigger,
    project,
    board,
    authoringMode,
  )

  return (
    <div
      className="space-y-3 border-t border-[var(--border)] bg-[var(--panel-3)] p-3"
      data-logic-rule-editor
    >
      <LogicBlock
        title="When"
        icon={<Zap size={13} />}
        tone="when"
      >
        {compatError && (
          <p className="mb-1 w-full text-[10px] leading-snug text-[var(--danger)]">
            {compatError} Change the trigger or move this rule to a compatible board.
          </p>
        )}
        <TypePicker
          kind="trigger"
          types={triggerTypes}
          value={event.trigger.type}
          onChange={(t) => {
            const nextTrigger = defaultTrigger(t as LogicTrigger['type'])
            onChange({
              ...event,
              trigger:
                nextTrigger.type === 'onInput' && hasMovementAction(event.actions)
                  ? { ...nextTrigger, eventType: 'down' }
                  : nextTrigger,
            })
          }}
        />
        <TriggerFields
          trigger={event.trigger}
          board={board}
          project={project}
          onChange={(t) => onChange({ ...event, trigger: t })}
        />
      </LogicBlock>

      <LogicBlock
        title="Also require…"
        optional
        icon={<ListChecks size={13} />}
        tone="if"
        action={
          <button
            type="button"
            onClick={() => setOnlyIfEnabled(!onlyIfEnabled)}
            title={
              onlyIfEnabled
                ? 'Disable Also require checks'
                : 'Enable Also require checks'
            }
            aria-label={
              onlyIfEnabled
                ? 'Disable Also require checks'
                : 'Enable Also require checks'
            }
            className={`relative h-[18px] w-9 rounded transition-colors ${
              onlyIfEnabled ? 'bg-[var(--warn)]' : 'bg-[var(--border-2)]'
            }`}
          >
            <span
              className={`absolute top-0.5 h-3.5 w-3.5 rounded transition-all ${
                onlyIfEnabled
                  ? 'right-0.5 bg-[var(--text)]'
                  : 'left-0.5 bg-[var(--muted)]'
              }`}
            />
          </button>
        }
      >
        <AlsoRequireSectionHints
          onlyIfEnabled={onlyIfEnabled}
          trigger={event.trigger}
          authoringMode={authoringMode}
        />
        {!onlyIfEnabled ? null : !advancedConditions ? (
          <>
            <SimpleConditions
              event={event}
              board={board}
              project={project}
              onChange={onChange}
              conditionTypes={pickerConditionTypes}
              recommendedConditions={pickerRecommendedConditions}
            />
            <button
              type="button"
              className={link}
              onClick={() => {
                setAdvancedConditions(true)
                if (!event.conditionRoot) {
                  onChange({
                    ...event,
                    onlyIfEnabled: true,
                    conditionRoot: defaultConditionRoot(),
                    conditions: undefined,
                  })
                }
              }}
            >
              {authoringMode === 'base'
                ? 'Nested AND/OR groups (advanced)…'
                : 'Nested AND/OR groups…'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={link}
              onClick={() => {
                setAdvancedConditions(false)
                onChange({
                  ...event,
                  onlyIfEnabled: true,
                  conditions: [],
                  conditionRoot: undefined,
                })
              }}
            >
              Back to simple checks
            </button>
            <ConditionTreeEditor
              event={event}
              onChange={onChange}
              advanced
              conditionTypes={pickerConditionTypes}
              recommendedConditionTypes={pickerRecommendedConditions}
            />
          </>
        )}
      </LogicBlock>

      <LogicBlock
        title="Then"
        icon={<GitBranch size={13} />}
        tone="then"
      >
        <p className="text-[10px] leading-snug text-[var(--muted)]">
          When <strong>Also require…</strong> checks pass.
        </p>
        <ActionListBlock
          actions={event.actions}
          board={board}
          project={project}
          recommendedTypes={recommendedTypes}
          newActionType={newActionType}
          setNewActionType={setNewActionType}
          emptyHint="Add at least one action."
          onChangeActions={(actions) =>
            onChange(withContextualInputDefault(event, actions))
          }
        />
      </LogicBlock>

      {canUseElse && (
        <LogicBlock
          title="Else"
          optional
          icon={<Split size={13} />}
          tone="if"
          action={
            <button
              type="button"
              onClick={() => setElseEnabled(!elseEnabled)}
              title={
                elseEnabled
                  ? 'Disable Else actions'
                  : 'Enable Else actions'
              }
              aria-label={
                elseEnabled
                  ? 'Disable Else actions'
                  : 'Enable Else actions'
              }
              className={`relative h-[18px] w-9 rounded transition-colors ${
                elseEnabled ? 'bg-[var(--warn)]' : 'bg-[var(--border-2)]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-3.5 w-3.5 rounded transition-all ${
                  elseEnabled
                    ? 'right-0.5 bg-[var(--text)]'
                    : 'left-0.5 bg-[var(--muted)]'
                }`}
              />
            </button>
          }
        >
          <p className="text-[10px] leading-snug text-[var(--muted)]">
            When <strong>Also require…</strong> checks <strong>fail</strong> (opposite
            of Then).
          </p>
          {!elseEnabled ? null : (
            <ActionListBlock
              actions={event.elseActions ?? []}
              board={board}
              project={project}
              recommendedTypes={recommendedTypes}
              newActionType={newElseActionType}
              setNewActionType={setNewElseActionType}
              emptyHint="Add at least one Else action."
              onChangeActions={(elseActions) =>
                onChange({ ...event, elseEnabled: true, elseActions })
              }
            />
          )}
        </LogicBlock>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-4 py-2 text-xs font-semibold text-[var(--accent)]"
          onClick={onDone}
        >
          <Check size={13} />
          Save rule
        </button>
      </div>
    </div>
  )
}
