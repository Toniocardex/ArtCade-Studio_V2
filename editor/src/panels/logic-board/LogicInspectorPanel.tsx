import { useMemo } from 'react'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import { logicBoardLabel } from '../../utils/project'
import { SchemaParamForm } from '../../components/logic-board/SchemaParamForm'
import { OnInputTriggerFields } from '../../components/logic-board/OnInputTriggerFields'
import { ConditionTreeEditor } from '../../components/logic-board/ConditionTreeEditor'
import { SectionCollapse } from '../../components/ui/SectionCollapse'
import { eventTriggerSummaryPlain } from './friendly-labels'
import type { ProjectDoc } from '../../types'
import { useEditorSelector } from '../../store/editor-store'
import { resolveClipContextForLogicBoard } from '../../utils/entity-clip-resolve'
import {
  conditionTypesForTrigger,
  conditionTypesInUse,
  recommendedConditionTypes,
} from '../../utils/logic-board/condition-picker'
import type { LogicBlockSelection } from './useLogicBlockSelection'

export type { LogicBlockSelection } from './useLogicBlockSelection'

export type LogicInspectorPanelProps = Readonly<{
  project: ProjectDoc
  board: LogicBoard | null
  event: LogicEvent | null
  selection: LogicBlockSelection
  onPatchEvent: (event: LogicEvent) => void
}>

export function LogicInspectorPanel({
  project,
  board,
  event,
  selection,
  onPatchEvent,
}: LogicInspectorPanelProps) {
  const authoringMode = useEditorSelector((s) => s.authoringMode)

  const clipContext = useMemo(
    () => resolveClipContextForLogicBoard(project, board),
    [project, board],
  )
  const contextSpritePath = clipContext.ambiguousSpritePath ? undefined : clipContext.spritePath
  const ambiguousTargetSpritePaths = clipContext.ambiguousSpritePath === true

  if (!board || !event) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-[10px] text-[var(--muted)] text-center">
        Select an event to inspect blocks.
      </div>
    )
  }

  const patchTrigger = (trigger: LogicEvent['trigger']) => {
    onPatchEvent({ ...event, trigger })
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

  const usesConditionTree = event.conditionRoot != null

  return (
    <div className="h-full flex flex-col min-h-0 overflow-auto panel-scroll bg-[var(--surface)]" data-panel="logic-inspector">
      <header className="shrink-0 px-3 py-2 border-b border-[var(--outline)]">
        <p className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Logic Inspector</p>
        <p className="text-[11px] font-semibold text-[var(--primary)] mt-0.5">{logicBoardLabel(project, board)}</p>
        <p className="text-[10px] text-[var(--muted)]">{eventTriggerSummaryPlain(event, project)}</p>
      </header>

      <SectionCollapse title="Context" defaultOpen>
        <dl className="text-[10px] space-y-1 text-[var(--primary-soft)]">
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--muted)]">Rulesheet</dt>
            <dd className="font-mono truncate">{board.boardId}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--muted)]">Event id</dt>
            <dd className="font-mono truncate">{event.id}</dd>
          </div>
        </dl>
      </SectionCollapse>

      {selection?.kind === 'trigger' && (
        <SectionCollapse title="Trigger settings" defaultOpen>
          {event.trigger.type === 'onInput' ? (
            <OnInputTriggerFields trigger={event.trigger} onChange={patchTrigger} />
          ) : (
            <SchemaParamForm
              kind="trigger"
              type={event.trigger.type}
              value={event.trigger as Record<string, unknown>}
              onChange={(next) => patchTrigger(next as LogicEvent['trigger'])}
            />
          )}
        </SectionCollapse>
      )}

      {selection?.kind === 'conditionTree' && usesConditionTree && (
        <SectionCollapse title="Condition tree" defaultOpen>
          <ConditionTreeEditor
            event={event}
            onChange={onPatchEvent}
            advanced
            conditionTypes={pickerConditionTypes}
            recommendedConditionTypes={pickerRecommendedConditions}
            contextSpritePath={contextSpritePath}
            ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
          />
        </SectionCollapse>
      )}

      {selection?.kind === 'condition' && !usesConditionTree && event.conditions?.[selection.index] && (
        <SectionCollapse title="Condition settings" defaultOpen>
          <SchemaParamForm
            kind="condition"
            type={event.conditions[selection.index].type}
            value={event.conditions[selection.index] as Record<string, unknown>}
            onChange={(next) => {
              const conditions = [...(event.conditions ?? [])]
              conditions[selection.index] = next as (typeof conditions)[number]
              onPatchEvent({ ...event, conditions })
            }}
            contextSpritePath={contextSpritePath}
            ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
          />
        </SectionCollapse>
      )}

      {selection?.kind === 'condition' && usesConditionTree && (
        <p className="p-3 text-[10px] text-[var(--muted)]">
          This rule uses nested condition groups. Select the condition block header or open the tree section.
        </p>
      )}

      {selection?.kind === 'action' && event.actions[selection.index] && (
        <SectionCollapse title="Action settings" defaultOpen>
          <SchemaParamForm
            kind="action"
            type={event.actions[selection.index].type}
            value={event.actions[selection.index] as Record<string, unknown>}
            onChange={(next) => {
              const actions = [...event.actions]
              actions[selection.index] = next as (typeof actions)[number]
              onPatchEvent({ ...event, actions })
            }}
            contextSpritePath={contextSpritePath}
            ambiguousTargetSpritePaths={ambiguousTargetSpritePaths}
          />
        </SectionCollapse>
      )}

      {!selection && (
        <p className="p-3 text-[10px] text-[var(--muted)]">
          Click a trigger, condition, or action in the event editor to edit parameters here.
        </p>
      )}
    </div>
  )
}
