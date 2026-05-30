// ---------------------------------------------------------------------------
// Expanded rule editor - When / Also require… / Then blocks
// ---------------------------------------------------------------------------

import { Fragment, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { HierarchicalBlockPicker } from '../../components/logic-board/HierarchicalBlockPicker'
import type { LogicBlockSelection } from './useLogicBlockSelection'
import {
  NEW_ACTION_NONE,
  NEW_CONDITION_NONE,
  type NewActionPick,
  type NewConditionPick,
} from './picker-constants'
import {
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
import { resolveClipContextForLogicBoard } from '../../utils/entity-clip-resolve'
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
import { repeatBodyIndices } from '../../utils/logic-board/repeat-body-indices'
import { eventHasConditionBlock } from '../../utils/logic-board/event-conditions'
import {
  ACTION_TYPES,
  defaultAction,
  defaultCondition,
  defaultTrigger,
  TRIGGER_TYPES,
} from './options'
import { applyClickToDestroyTrigger } from '../../utils/logic-board/click-to-destroy'
import {
  destroyOtherTargetWarning,
  destroySelfOnCollisionWarning,
} from '../../utils/logic-board/logic-action-warnings'

const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'
const btn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] hover:border-[var(--accent-bd)]'
const btnDisabled =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border-2)] bg-[var(--border)] text-[var(--muted)] opacity-50 cursor-not-allowed'

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

function commitEventUpdate(
  event: LogicEvent,
  patch: Partial<LogicEvent> | LogicEvent,
): LogicEvent {
  const merged =
    'id' in patch && 'trigger' in patch && 'actions' in patch
      ? (patch as LogicEvent)
      : { ...event, ...patch }
  return applyClickToDestroyTrigger(
    withContextualInputDefault(merged, merged.actions),
  )
}

function actionTypesForBoard(
  board: LogicBoard | null | undefined,
  options?: { forElse?: boolean; existingActions?: readonly LogicAction[] },
): readonly LogicAction['type'][] {
  const isEntity =
    board?.target.type === 'entity_id' || board?.target.type === 'entity_class'
  let types: readonly LogicAction['type'][] = isEntity
    ? ACTION_TYPES
    : ACTION_TYPES.filter((t) => t !== 'clickToDestroy')
  if (options?.forElse) {
    types = types.filter((t) => t !== 'clickToDestroy')
  }
  if (options?.existingActions?.some((a) => a.type === 'clickToDestroy')) {
    types = types.filter((t) => t !== 'clickToDestroy')
  }
  return types
}

function TriggerFields({
  trigger,
  board,
  project,
  contextSpritePath,
  ambiguousTargetSpritePaths,
  onChange,
  hideParams,
}: {
  trigger: LogicTrigger
  board?: LogicBoard | null
  project?: ProjectDoc | null
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
  onChange: (t: LogicTrigger) => void
  hideParams?: boolean
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
        hideParams ? (
          <p className="text-[10px] text-[var(--muted)]">Edit key bindings in the Logic Inspector.</p>
        ) : (
          <OnInputTriggerFields trigger={trigger} onChange={(t) => onChange(t)} />
        )
      ) : hideParams ? (
        <p className="text-[10px] text-[var(--muted)]">Edit trigger parameters in the Logic Inspector.</p>
      ) : (
        <SchemaParamForm
          kind="trigger"
          type={trigger.type}
          value={trigger as unknown as Record<string, unknown>}
          onChange={(next) => onChange(next as LogicTrigger)}
          contextSpritePath={contextSpritePath}
          ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
        />
      )}
      {isCollisionTrigger && (
        <p className="text-[10px] leading-snug text-[var(--muted)]">
          Requires physics overlap: add <strong>Physics (Collider)</strong> on this entity
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
  trigger,
  board,
  project,
  contextSpritePath,
  ambiguousTargetSpritePaths,
  recommendedTypes,
  onChangeActions,
  newActionType,
  setNewActionType,
  emptyHint,
  forElse = false,
  hideParams,
  useHierarchicalPicker,
  onActionSelect,
  isActionSelected,
}: {
  actions: LogicAction[]
  trigger: LogicTrigger
  board?: LogicBoard | null
  project?: ProjectDoc | null
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
  recommendedTypes: readonly string[]
  onChangeActions: (actions: LogicAction[]) => void
  newActionType: NewActionPick
  setNewActionType: (t: NewActionPick) => void
  emptyHint: string
  /** When true, Click to destroy is omitted from the action picker (Else branch). */
  forElse?: boolean
  hideParams?: boolean
  useHierarchicalPicker?: boolean
  onActionSelect?: (index: number) => void
  isActionSelected?: (index: number) => boolean
}) {
  const insideRepeat = repeatBodyIndices(actions)
  const pickerTypes = actionTypesForBoard(board, { forElse, existingActions: actions })
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <>
      {actions.length === 0 && (
        <p className="text-[11px] text-[var(--muted)]">{emptyHint}</p>
      )}
      {actions.map((a, i) => (
        <ActionCard
          key={i}
          act={a}
          trigger={trigger}
          nestedInRepeat={insideRepeat.has(i)}
          board={board}
          project={project}
          contextSpritePath={contextSpritePath}
          ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
          forElse={forElse}
          pickerTypes={pickerTypes}
          recommendedTypes={recommendedTypes}
          onChange={(na) => {
            const next = actions.slice()
            next[i] = na
            onChangeActions(next)
          }}
          onRemove={() => onChangeActions(actions.filter((_, j) => j !== i))}
          hideParams={hideParams}
          onSelect={() => onActionSelect?.(i)}
          selected={isActionSelected?.(i) ?? false}
          onClone={() => {
            if (
              a.type === 'clickToDestroy' &&
              actions.some((x) => x.type === 'clickToDestroy')
            ) {
              return
            }
            const next = actions.slice()
            next.splice(i + 1, 0, cloneLogicAction(a))
            onChangeActions(next)
          }}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {useHierarchicalPicker && (
          <button
            type="button"
            className={btn}
            onClick={() => setPickerOpen(true)}
          >
            Browse actions…
          </button>
        )}
        {pickerOpen && useHierarchicalPicker && (
          <div className="fixed inset-0 z-[70] flex justify-end bg-black/40" onClick={() => setPickerOpen(false)}>
            <div onClick={(e: MouseEvent) => e.stopPropagation()}>
              <HierarchicalBlockPicker
                kind="action"
                types={pickerTypes}
                title="Add action"
                onClose={() => setPickerOpen(false)}
                onPick={(type) => {
                  onChangeActions([...actions, defaultAction(type as LogicAction['type'])])
                  setPickerOpen(false)
                }}
              />
            </div>
          </div>
        )}
        <TypePicker
          kind="action"
          types={pickerTypes}
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
  trigger,
  nestedInRepeat,
  board,
  project,
  contextSpritePath,
  ambiguousTargetSpritePaths,
  forElse,
  pickerTypes,
  recommendedTypes,
  onChange,
  onClone,
  onRemove,
  hideParams,
  onSelect,
  selected,
}: {
  act: LogicAction
  trigger: LogicTrigger
  nestedInRepeat?: boolean
  board?: LogicBoard | null
  project?: ProjectDoc | null
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
  forElse?: boolean
  pickerTypes: readonly LogicAction['type'][]
  recommendedTypes: readonly string[]
  onChange: (a: LogicAction) => void
  onClone: () => void
  onRemove: () => void
  hideParams?: boolean
  onSelect?: () => void
  selected?: boolean
}) {
  const destroyOtherWarn = destroyOtherTargetWarning(act, trigger)
  const destroySelfWarn = destroySelfOnCollisionWarning(act, trigger)
  return (
    <div
      onClick={onSelect}
      className={`space-y-2 rounded border bg-[var(--logic-card)] p-2.5 ${onSelect ? 'cursor-pointer' : ''} ${
        selected ? 'ring-1 ring-[var(--accent)]' : ''
      } ${
        nestedInRepeat
          ? 'ml-4 border-[var(--accent-bd)] border-l-2'
          : 'border-[var(--border)]'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TypePicker
          kind="action"
          types={
            act.type === 'clickToDestroy'
              ? pickerTypes.includes('clickToDestroy')
                ? pickerTypes
                : [...pickerTypes, 'clickToDestroy']
              : pickerTypes
          }
          value={act.type}
          onChange={(t) => {
            if (forElse && t === 'clickToDestroy') return
            onChange(defaultAction(t as LogicAction['type']))
          }}
          className="max-w-[220px]"
          recommendedTypes={recommendedTypes}
        />
        <span className="text-[10px] text-[var(--muted)]">
          {actionDisplayName(act.type)}
        </span>
        <div className="flex-1" />
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <LogicIconButton
          title="Clone action"
          ariaLabel="Clone action"
          onClick={onClone}
        >
          <Copy size={13} />
        </LogicIconButton>
        </span>
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <LogicIconButton
          title="Remove action"
          ariaLabel="Remove action"
          danger
          onClick={onRemove}
        >
          <Trash2 size={13} />
        </LogicIconButton>
        </span>
      </div>
      {hideParams ? (
        <p className="text-[10px] text-[var(--muted)]">Edit action parameters in the Logic Inspector.</p>
      ) : (
        <SchemaParamForm
          kind="action"
          type={act.type}
          value={act as unknown as Record<string, unknown>}
          onChange={(next) => onChange(next as LogicAction)}
          contextSpritePath={contextSpritePath}
          ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
        />
      )}
      <ComponentRequirementWarning requirement={actionRequirement(act, project, board)} />
      {destroyOtherWarn && (
        <p className="w-full text-[10px] leading-snug text-[var(--warn)]">
          {destroyOtherWarn}
        </p>
      )}
      {destroySelfWarn && (
        <p className="w-full text-[10px] leading-snug text-[var(--warn)]">
          {destroySelfWarn}
        </p>
      )}
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
      {act.type === 'clickToDestroy' && (
        <p className="text-[10px] text-[var(--muted)]">
          Sets <strong>When</strong> to Object clicked and destroys this entity on click.
          Press Play in the preview to test.
        </p>
      )}
      {act.type === 'repeatTimes' && (
        <p className="text-[10px] leading-snug text-[var(--muted)]">
          Actions listed <strong>below</strong> Repeat run once per iteration (until the
          next Wait or Repeat). Set <strong>Every</strong> to <strong>0</strong> to run
          all iterations in one frame.
        </p>
      )}
      {nestedInRepeat && (
        <p className="text-[10px] text-[var(--accent)]">Inside Repeat above</p>
      )}
    </div>
  )
}

const condSel =
  'bg-[var(--panel-3)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'

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
  contextSpritePath,
  ambiguousTargetSpritePaths,
  onChange,
  conditionTypes,
  recommendedConditions,
  hideParams,
  onConditionSelect,
  isConditionSelected,
  useHierarchicalPicker,
}: {
  event: LogicEvent
  board?: LogicBoard | null
  project?: ProjectDoc | null
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
  onChange: (e: LogicEvent) => void
  conditionTypes: readonly LogicCondition['type'][]
  recommendedConditions: readonly LogicCondition['type'][]
  hideParams?: boolean
  onConditionSelect?: (index: number) => void
  isConditionSelected?: (index: number) => boolean
  useHierarchicalPicker?: boolean
}) {
  const conditions = event.conditions ?? []
  const combineOp = event.conditionsOperator ?? 'AND'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [newConditionType, setNewConditionType] = useState<NewConditionPick>(NEW_CONDITION_NONE)

  function appendCondition(type: LogicCondition['type']) {
    onChange({
      ...event,
      onlyIfEnabled: true,
      conditions: [...conditions, defaultCondition(type)],
      conditionRoot: undefined,
    })
  }

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
          role="presentation"
          onClick={() => onConditionSelect?.(i)}
          className={`flex flex-wrap items-center gap-2 rounded border border-[var(--border)] bg-[var(--logic-block)] px-2 py-1.5 ${
            onConditionSelect ? 'cursor-pointer' : ''
          } ${isConditionSelected?.(i) ? 'ring-1 ring-[var(--accent)]' : ''}`}
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
          {hideParams ? (
            <p className="text-[10px] text-[var(--muted)]">Edit check parameters in the Logic Inspector.</p>
          ) : (
            <SchemaParamForm
              kind="condition"
              type={c.type}
              value={c as unknown as Record<string, unknown>}
              onChange={(next) => {
                const conds = conditions.slice()
                conds[i] = { ...(next as LogicCondition), negated: c.negated }
                onChange({ ...event, conditions: conds, conditionRoot: undefined })
              }}
              contextSpritePath={contextSpritePath}
              ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
            />
          )}
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
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {useHierarchicalPicker && (
          <button type="button" className={btn} onClick={() => setPickerOpen(true)}>
            Browse checks…
          </button>
        )}
        {pickerOpen && useHierarchicalPicker && (
          <div className="fixed inset-0 z-[70] flex justify-end bg-black/40" onClick={() => setPickerOpen(false)}>
            <div onClick={(e: MouseEvent) => e.stopPropagation()}>
              <HierarchicalBlockPicker
                kind="condition"
                types={conditionTypes}
                title="Add check"
                onClose={() => setPickerOpen(false)}
                onPick={(type) => {
                  appendCondition(type as LogicCondition['type'])
                  setPickerOpen(false)
                }}
              />
            </div>
          </div>
        )}
        <TypePicker
          kind="condition"
          types={conditionTypes}
          value={newConditionType}
          onChange={(t) => setNewConditionType(t as LogicCondition['type'])}
          className="max-w-[240px]"
          recommendedTypes={recommendedConditions}
          placeholder="Select check…"
          placeholderValue={NEW_CONDITION_NONE}
        />
        <button
          type="button"
          className={newConditionType ? btn : btnDisabled}
          disabled={!newConditionType}
          title={
            newConditionType
              ? 'Add the selected check'
              : 'Choose a check from the list first'
          }
          onClick={() => {
            if (!newConditionType) return
            appendCondition(newConditionType)
            setNewConditionType(NEW_CONDITION_NONE)
          }}
        >
          <Plus size={13} />
          Add check
        </button>
      </div>
    </div>
  )
}

export default function EventEditor({
  event,
  board,
  project,
  onChange,
  onDone,
  inspectorMode = false,
  onBlockSelect,
  isBlockSelected,
}: {
  event: LogicEvent
  board?: LogicBoard | null
  project?: ProjectDoc | null
  onChange: (e: LogicEvent) => void
  onDone?: () => void
  inspectorMode?: boolean
  onBlockSelect?: (sel: LogicBlockSelection) => void
  isBlockSelected?: (block: LogicBlockSelection) => boolean
}) {
  const { state } = useEditor()
  const authoringMode = state.authoringMode
  const [advancedConditions, setAdvancedConditions] = useState(
    () => event.conditionRoot != null,
  )

  useEffect(() => {
    setAdvancedConditions(event.conditionRoot != null)
  }, [event.id, event.conditionRoot])
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
  const logicBoardClipContext = useMemo(
    () => resolveClipContextForLogicBoard(project, board),
    [project, board],
  )
  const contextSpritePath = logicBoardClipContext.ambiguousSpritePath
    ? undefined
    : logicBoardClipContext.spritePath
  const ambiguousTargetSpritePaths = logicBoardClipContext.ambiguousSpritePath === true

  const whenTitle = inspectorMode ? '1. Trigger' : 'When'
  const ifTitle = inspectorMode ? '2. Conditions' : 'Also require…'
  const thenTitle = inspectorMode ? '3. Actions' : 'Then'
  const hideParams = inspectorMode

  return (
    <div
      className="space-y-3 border border-[var(--outline)] bg-[var(--surface)] p-3 rounded-[var(--radius-md)]"
      data-logic-rule-editor
    >
      <div
        role="button"
        tabIndex={0}
        className={`rounded-[var(--radius)] ${isBlockSelected?.({ kind: 'trigger' }) ? 'ring-1 ring-[var(--accent)]' : ''}`}
        onClick={() => onBlockSelect?.({ kind: 'trigger' })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onBlockSelect?.({ kind: 'trigger' })
        }}
      >
      <LogicBlock
        title={whenTitle}
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
            onChange(
              commitEventUpdate(event, {
                trigger:
                  nextTrigger.type === 'onInput' && hasMovementAction(event.actions)
                    ? { ...nextTrigger, eventType: 'down' }
                    : nextTrigger,
              }),
            )
          }}
        />
        <TriggerFields
          trigger={event.trigger}
          board={board}
          project={project}
          contextSpritePath={contextSpritePath}
          ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
          hideParams={hideParams}
          onChange={(t) => onChange(commitEventUpdate(event, { trigger: t }))}
        />
      </LogicBlock>
      </div>

      <LogicBlock
        title={ifTitle}
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
              contextSpritePath={contextSpritePath}
              ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
              onChange={onChange}
              conditionTypes={pickerConditionTypes}
              recommendedConditions={pickerRecommendedConditions}
              hideParams={hideParams}
              useHierarchicalPicker={inspectorMode}
              onConditionSelect={hideParams ? (i) => onBlockSelect?.({ kind: 'condition', index: i }) : undefined}
              isConditionSelected={
                hideParams
                  ? (i) => isBlockSelected?.({ kind: 'condition', index: i }) ?? false
                  : undefined
              }
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
                onBlockSelect?.({ kind: 'conditionTree' })
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
                onBlockSelect?.({ kind: 'trigger' })
              }}
            >
              Back to simple checks
            </button>
            {hideParams ? (
              <div
                role="presentation"
                onClick={() => onBlockSelect?.({ kind: 'conditionTree' })}
                className={`rounded border border-[var(--border)] px-2 py-2 cursor-pointer ${
                  isBlockSelected?.({ kind: 'conditionTree' }) ? 'ring-1 ring-[var(--accent)]' : ''
                }`}
              >
                <p className="text-[10px] text-[var(--muted)]">
                  Nested AND/OR groups — edit parameters in the Logic Inspector.
                </p>
              </div>
            ) : (
              <ConditionTreeEditor
                event={event}
                onChange={onChange}
                advanced
                conditionTypes={pickerConditionTypes}
                recommendedConditionTypes={pickerRecommendedConditions}
                contextSpritePath={contextSpritePath}
                ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
              />
            )}
          </>
        )}
      </LogicBlock>

      <LogicBlock
        title={thenTitle}
        icon={<GitBranch size={13} />}
        tone="then"
      >
        <p className="text-[10px] leading-snug text-[var(--muted)]">
          When <strong>Also require…</strong> checks pass.
        </p>
        <ActionListBlock
          actions={event.actions}
          trigger={event.trigger}
          board={board}
          project={project}
          contextSpritePath={contextSpritePath}
          ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
          recommendedTypes={recommendedTypes}
          newActionType={newActionType}
          setNewActionType={setNewActionType}
          emptyHint="Add at least one action."
          hideParams={hideParams}
          useHierarchicalPicker={inspectorMode}
          onActionSelect={(index) => onBlockSelect?.({ kind: 'action', index })}
          isActionSelected={(index) => isBlockSelected?.({ kind: 'action', index }) ?? false}
          onChangeActions={(actions) =>
            onChange(commitEventUpdate(event, { actions }))
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
              trigger={event.trigger}
              board={board}
              project={project}
              contextSpritePath={contextSpritePath}
              ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
              recommendedTypes={recommendedTypes}
              newActionType={newElseActionType}
              setNewActionType={setNewElseActionType}
              emptyHint="Add at least one Else action."
              forElse
              onChangeActions={(elseActions) =>
                onChange({ ...event, elseEnabled: true, elseActions })
              }
            />
          )}
        </LogicBlock>
      )}

      {!inspectorMode && onDone ? (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-4 py-2 text-xs font-semibold text-[var(--accent)]"
            onClick={onDone}
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  )
}
