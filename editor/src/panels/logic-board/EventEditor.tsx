// ---------------------------------------------------------------------------
// Expanded rule editor - When / Also require… / Then blocks
// ---------------------------------------------------------------------------

import { Fragment, useEffect, useMemo, useState } from 'react'
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
import { CatalogSelectButton } from '../../components/logic-board/CatalogSelectButton'
import {
  actionCatalogText,
  conditionCatalogText,
} from '../../components/logic-board/catalog-copy'
import { SchemaParamForm } from '../../components/logic-board/SchemaParamForm'
import { ModifyVariableEditor } from '../../components/logic-board/ModifyVariableEditor'
import { ConditionCombineSelect } from '../../components/logic-board/ConditionCombineSelect'
import { ConditionPolaritySelect } from '../../components/logic-board/ConditionPolaritySelect'
import { ConditionTreeEditor } from '../../components/logic-board/ConditionTreeEditor'
import type { ConditionCombineOp } from '../../utils/logic-board/condition-combine'
import { OnInputTriggerFields } from '../../components/logic-board/OnInputTriggerFields'
import { resolveClipContextForLogicBoard } from '../../utils/entity-clip-resolve'
import { defaultConditionRoot } from '../../utils/logic-board/schema-registry'
import { actionDisplayName, conditionDisplayName } from './friendly-labels'
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
import { useEditorSelector } from '../../store/editor-store'
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
import {
  applyClickToDestroyTrigger,
  isEntityBoardTarget,
} from '../../utils/logic-board/click-to-destroy'
import {
  destroyOtherTargetWarning,
  destroySelfOnCollisionWarning,
} from '../../utils/logic-board/logic-action-warnings'

const link = 'text-[var(--muted)] text-[11px] underline underline-offset-2 hover:text-[var(--text)] cursor-pointer'
const btn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] hover:border-[var(--accent-bd)]'

function hasMovementAction(actions: readonly LogicAction[]): boolean {
  return actions.some((action) => action.type === 'controllerMovement')
}

/** Variable-mutation actions (unified + legacy) edited via ModifyVariableEditor. */
const VARIABLE_ACTION_TYPES = new Set<LogicAction['type']>([
  'modifyVariable',
  'setVariable', 'addVariable',
  'setGlobalVariable', 'addGlobalVariable',
  'setLocalVariable', 'addLocalVariable',
  'multiplyVariable',
])

function actionFitsTrigger(actionType: LogicAction['type'], trigger: LogicTrigger): boolean {
  if (actionType !== 'controllerMovement') return true
  return trigger.type === 'onInput'
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
  const isEntity = board != null && isEntityBoardTarget(board.target)
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

function actionTypesForExistingAction(
  action: LogicAction,
  pickerTypes: readonly LogicAction['type'][],
): readonly LogicAction['type'][] {
  if (action.type !== 'clickToDestroy' || pickerTypes.includes('clickToDestroy')) {
    return pickerTypes
  }
  return [...pickerTypes, 'clickToDestroy']
}

function TriggerFields({
  trigger,
  board,
  project,
  contextSpritePath,
  ambiguousTargetSpritePaths,
  onChange,
}: {
  trigger: LogicTrigger
  board?: LogicBoard | null
  project?: ProjectDoc | null
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
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
        <OnInputTriggerFields trigger={trigger} onChange={(t) => onChange(t)} />
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
  emptyHint,
  forElse = false,
}: {
  actions: LogicAction[]
  trigger: LogicTrigger
  board?: LogicBoard | null
  project?: ProjectDoc | null
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
  recommendedTypes: readonly string[]
  onChangeActions: (actions: LogicAction[]) => void
  emptyHint: string
  /** When true, Click to destroy is omitted from the action picker (Else branch). */
  forElse?: boolean
}) {
  const insideRepeat = repeatBodyIndices(actions)
  const pickerTypes = actionTypesForBoard(board, { forElse, existingActions: actions })
  const addText = actionCatalogText('add', forElse)
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
      <div className="pt-1">
        <CatalogSelectButton
          kind="action"
          label="Add action"
          buttonTitle="Browse the action catalog"
          icon={<Plus size={13} />}
          title={addText.title}
          subtitle={addText.subtitle}
          searchPlaceholder={addText.searchPlaceholder}
          types={pickerTypes}
          recommendedTypes={recommendedTypes}
          onPick={(t) =>
            onChangeActions([...actions, defaultAction(t as LogicAction['type'])])
          }
        />
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
}) {
  const destroyOtherWarn = destroyOtherTargetWarning(act, trigger)
  const destroySelfWarn = destroySelfOnCollisionWarning(act, trigger)
  const actionPickerTypes = actionTypesForExistingAction(act, pickerTypes)
  const changeText = actionCatalogText('change', forElse)
  return (
    <div
      className={`space-y-2 rounded border bg-[var(--logic-card)] p-2.5 ${
        nestedInRepeat
          ? 'ml-4 border-[var(--accent-bd)] border-l-2'
          : 'border-[var(--border)]'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CatalogSelectButton
          kind="action"
          label={actionDisplayName(act.type)}
          buttonTitle="Change action"
          buttonClassName={`${btn} max-w-[220px] justify-between`}
          title={changeText.title}
          subtitle={changeText.subtitle}
          searchPlaceholder={changeText.searchPlaceholder}
          types={actionPickerTypes}
          recommendedTypes={recommendedTypes}
          onPick={(t) => {
            if (forElse && t === 'clickToDestroy') return
            onChange(defaultAction(t as LogicAction['type']))
          }}
        />
        <span className="text-[10px] text-[var(--muted)]">
          {actionDisplayName(act.type)}
        </span>
        <div className="flex-1" />
        <LogicIconButton
          title="Clone action"
          ariaLabel="Clone action"
          onClick={onClone}
        >
          <Copy size={13} />
        </LogicIconButton>
        <LogicIconButton
          title="Remove action"
          ariaLabel="Remove action"
          danger
          onClick={onRemove}
        >
          <Trash2 size={13} />
        </LogicIconButton>
      </div>
      {VARIABLE_ACTION_TYPES.has(act.type)
        ? (
          <ModifyVariableEditor
            action={act}
            project={project}
            onChange={onChange}
          />
        )
        : (
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

function ConditionRow({
  condition,
  conditionTypes,
  recommendedConditions,
  board,
  project,
  contextSpritePath,
  ambiguousTargetSpritePaths,
  onChangeCondition,
  onRemove,
}: {
  condition: LogicCondition & { negated?: boolean }
  conditionTypes: readonly LogicCondition['type'][]
  recommendedConditions: readonly LogicCondition['type'][]
  board?: LogicBoard | null
  project?: ProjectDoc | null
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
  onChangeCondition: (condition: LogicCondition & { negated?: boolean }) => void
  onRemove: () => void
}) {
  const changeText = conditionCatalogText('change')

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] bg-[var(--logic-block)] px-2 py-1.5"
    >
      <ConditionPolaritySelect
        negated={condition.negated}
        onChange={(negated) =>
          onChangeCondition({ ...condition, negated: negated || undefined })
        }
      />
      <CatalogSelectButton
        kind="condition"
        label={conditionDisplayName(condition.type)}
        buttonTitle="Change check"
        buttonClassName={`${btn} max-w-[200px] justify-between`}
        title={changeText.title}
        subtitle={changeText.subtitle}
        searchPlaceholder={changeText.searchPlaceholder}
        types={conditionTypes}
        recommendedTypes={recommendedConditions}
        onPick={(t) =>
          onChangeCondition({
            ...defaultCondition(t as LogicCondition['type']),
            negated: condition.negated,
          })
        }
      />
      <SchemaParamForm
        kind="condition"
        type={condition.type}
        value={condition as unknown as Record<string, unknown>}
        onChange={(next) =>
          onChangeCondition({
            ...(next as LogicCondition),
            negated: condition.negated,
          })
        }
        contextSpritePath={contextSpritePath}
        ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
      />
      <ComponentRequirementWarning requirement={conditionRequirement(condition, project, board)} />
      <button
        type="button"
        className={link}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
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
}: {
  event: LogicEvent
  board?: LogicBoard | null
  project?: ProjectDoc | null
  contextSpritePath?: string
  ambiguousTargetSpritePaths?: boolean
  onChange: (e: LogicEvent) => void
  conditionTypes: readonly LogicCondition['type'][]
  recommendedConditions: readonly LogicCondition['type'][]
}) {
  const conditions = event.conditions ?? []
  const combineOp = event.conditionsOperator ?? 'AND'
  const addText = conditionCatalogText('add')

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
          <ConditionRow
            condition={c}
            conditionTypes={conditionTypes}
            recommendedConditions={recommendedConditions}
            board={board}
            project={project}
            contextSpritePath={contextSpritePath}
            ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
            onChangeCondition={(condition) => {
              const conds = conditions.slice()
              conds[i] = condition
              onChange({ ...event, conditions: conds, conditionRoot: undefined })
            }}
            onRemove={() =>
              onChange({
                ...event,
                onlyIfEnabled: true,
                conditions: conditions.filter((_, j) => j !== i),
              })
            }
          />
        </Fragment>
      ))}
      {conditions.length === 1 && (
        <div className="flex flex-wrap items-center gap-2 py-0.5 pl-1">
          <span className="text-[10px] text-[var(--muted)]">Combine</span>
          <ConditionCombineSelect
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
      <div className="pt-1">
        <CatalogSelectButton
          kind="condition"
          label="Add check"
          buttonTitle="Browse the check catalog"
          icon={<Plus size={13} />}
          title={addText.title}
          subtitle={addText.subtitle}
          searchPlaceholder={addText.searchPlaceholder}
          types={conditionTypes}
          recommendedTypes={recommendedConditions}
          onPick={(t) => appendCondition(t as LogicCondition['type'])}
        />
      </div>
    </div>
  )
}

export default function EventEditor({
  event,
  board,
  project,
  onChange,
}: {
  event: LogicEvent
  board?: LogicBoard | null
  project?: ProjectDoc | null
  onChange: (e: LogicEvent) => void
}) {
  const authoringMode = useEditorSelector((s) => s.authoringMode)
  const [advancedConditions, setAdvancedConditions] = useState(
    () => event.conditionRoot != null,
  )

  useEffect(() => {
    setAdvancedConditions(event.conditionRoot != null)
  }, [event.id, event.conditionRoot])
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

  return (
    <div className="space-y-3" data-logic-rule-editor>
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
          onChange={(t) => onChange(commitEventUpdate(event, { trigger: t }))}
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
              contextSpritePath={contextSpritePath}
              ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
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
              contextSpritePath={contextSpritePath}
              ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
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
          trigger={event.trigger}
          board={board}
          project={project}
          contextSpritePath={contextSpritePath}
          ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
          recommendedTypes={recommendedTypes}
          emptyHint="Add at least one action."
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
              emptyHint="Add at least one Else action."
              forElse
              onChangeActions={(elseActions) =>
                onChange({ ...event, elseEnabled: true, elseActions })
              }
            />
          )}
        </LogicBlock>
      )}

    </div>
  )
}
