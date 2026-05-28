// ---------------------------------------------------------------------------
// One game rule rendered as a structured inspector-style card.
// Sections: header (trigger), ONLY IF (conditions), THEN (actions).
// ---------------------------------------------------------------------------

import type { DragEvent, ReactNode } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Pencil,
  Trash2,
  Zap,
} from 'lucide-react'
import { LOGIC_EVENT_DRAG_MIME } from '../../utils/logic-board/logic-event-list-ui'
import { useEditor } from '../../store/editor-store'
import type { LogicAction, LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import {
  actionSummaryPlain,
  conditionsPlainList,
  triggerExecutionBadge,
  eventTriggerSummaryPlain,
} from './friendly-labels'
import { rulesheetAppliesToLabel } from '../../utils/project'
import LogicIconButton from '../../components/logic-board/LogicIconButton'
import EventEditor from './EventEditor'

export type EventCardProps = Readonly<{
  event: LogicEvent
  board?: LogicBoard | null
  /** When false, entity label is shown on a parent section header instead. */
  showAppliesTo?: boolean
  editing: boolean
  selected?: boolean
  onSelect?: () => void
  /** Opens the rule editor (e.g. double-click); does not toggle closed. */
  onOpenEdit?: () => void
  onToggleEnabled: () => void
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
  onChange: (e: LogicEvent) => void
  onDoneEditing: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onReorderDrop?: (draggedEventId: string) => void
}>

function SectionLabel({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
      {children}
    </div>
  )
}

function zapTriggerTooltip(execLabel: string): string {
  if (execLabel === 'Every frame') return 'Trigger - checked every frame'
  if (execLabel === 'Triggered*') return 'Trigger - engine event when available'
  return 'Trigger - engine event'
}

function CardSelectButton({
  className = '',
  onSelect,
  onDoubleClick,
  title,
  ariaLabel,
  children,
}: Readonly<{
  className?: string
  onSelect?: () => void
  onDoubleClick?: () => void
  title?: string
  ariaLabel?: string
  children: ReactNode
}>) {
  if (!onSelect && !onDoubleClick) {
    return <div className={className}>{children}</div>
  }
  return (
    <button
      type="button"
      className={`block w-full border-0 bg-transparent p-0 text-left ${className}`}
      title={title}
      aria-label={ariaLabel}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.preventDefault()
        onDoubleClick?.()
      }}
    >
      {children}
    </button>
  )
}

function actionListKey(eventId: string, action: LogicAction, index: number): string {
  return `${eventId}:act:${action.type}:${index}`
}

function EventCardConditions({
  eventId,
  lines,
}: Readonly<{ eventId: string; lines: string[] }>) {
  return (
    <div className="border-b border-[var(--border)] bg-[rgba(var(--bg-rgb),0.25)] px-3 py-2.5 lg:border-b-0 lg:border-r">
      <SectionLabel>Also require…</SectionLabel>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {lines.map((line) => (
          <li
            key={`${eventId}:if:${line}`}
            className="relative pl-3 text-xs leading-snug text-[var(--text)]"
          >
            <span
              className="absolute left-0 top-[7px] h-1 w-1 bg-[var(--muted)]"
              aria-hidden="true"
            />
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

function EventCardActions({
  eventId,
  actions,
  project,
}: Readonly<{ eventId: string; actions: LogicAction[]; project: ProjectDoc | null }>) {
  return (
    <div className="relative px-3 py-2.5">
      <span
        className="absolute bottom-2.5 left-0 top-2.5 w-[2px] bg-[var(--accent)]"
        aria-hidden="true"
      />
      <div className="pl-2">
        <SectionLabel>Then</SectionLabel>
        {actions.length === 0 ? (
          <span className="text-xs italic text-[var(--muted-2)]">No actions yet</span>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {actions.map((action, index) => (
              <li
                key={actionListKey(eventId, action, index)}
                className="relative pl-5 text-xs leading-snug text-[var(--text)]"
              >
                <span
                  className="absolute left-0 top-0 text-[10px] font-semibold tabular-nums text-[var(--muted)]"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {actionSummaryPlain(action, project)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function EventCardHeader({
  event,
  project,
  showAppliesTo,
  appliesTo,
  dim,
  editing,
  zapTooltip,
  ruleSummary,
  onSelect,
  onOpenEdit,
  onToggleEnabled,
  onEdit,
  onClone,
  onDelete,
  selected,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: Readonly<{
  event: LogicEvent
  project: ProjectDoc | null
  showAppliesTo: boolean
  appliesTo: string | null
  dim: string
  editing: boolean
  zapTooltip: string
  ruleSummary: string
  onSelect?: () => void
  onOpenEdit?: () => void
  onToggleEnabled: () => void
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
  selected?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}>) {
  return (
    <div
      className={`flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--panel-3)] px-3 py-2.5 ${dim}`}
    >
      {selected && (
        <div className="flex shrink-0 flex-col gap-0.5">
          <LogicIconButton
            title="Move rule up"
            ariaLabel="Move rule up"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <ChevronUp size={13} />
          </LogicIconButton>
          <LogicIconButton
            title="Move rule down"
            ariaLabel="Move rule down"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <ChevronDown size={13} />
          </LogicIconButton>
        </div>
      )}
      <CardSelectButton
        className="flex min-w-0 flex-1 items-center gap-2.5"
        onSelect={onSelect}
        onDoubleClick={editing ? undefined : onOpenEdit}
        title={editing ? undefined : 'Double-click to edit rule'}
        ariaLabel={ruleSummary}
      >
        <div className="shrink-0 text-[var(--accent)]" title={zapTooltip}>
          <Zap size={13} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          {showAppliesTo && appliesTo && (
            <div
              className="mb-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]"
              title={`Applies to: ${appliesTo}`}
            >
              {appliesTo}
            </div>
          )}
          <div className="text-[13px] font-medium leading-snug text-[var(--text)]">
            {eventTriggerSummaryPlain(event, project)}
          </div>
        </div>
      </CardSelectButton>

      <button
        type="button"
        onClick={onToggleEnabled}
        title={event.enabled ? 'Rule enabled' : 'Rule disabled'}
        aria-label={event.enabled ? 'Rule enabled' : 'Rule disabled'}
        className={`relative h-[18px] w-9 shrink-0 rounded transition-colors ${
          event.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border-2)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded transition-all ${
            event.enabled ? 'right-0.5 bg-[var(--text)]' : 'left-0.5 bg-[var(--muted)]'
          }`}
        />
      </button>

      <fieldset
        aria-label="Rule actions"
        className="m-0 flex shrink-0 items-center gap-1 border-0 p-0"
      >
        <LogicIconButton
          title="Edit rule"
          ariaLabel="Edit rule"
          ariaExpanded={editing}
          active={editing}
          onClick={onEdit}
        >
          <Pencil size={13} />
        </LogicIconButton>
        <LogicIconButton title="Clone rule" ariaLabel="Clone rule" onClick={onClone}>
          <Copy size={13} />
        </LogicIconButton>
        <LogicIconButton title="Delete rule" ariaLabel="Delete rule" danger onClick={onDelete}>
          <Trash2 size={13} />
        </LogicIconButton>
      </fieldset>
    </div>
  )
}

export default function EventCard(props: EventCardProps) {
  const {
    event,
    board,
    editing,
    selected,
    onSelect,
    onOpenEdit,
    onToggleEnabled,
    onEdit,
    onClone,
    onDelete,
    onChange,
    onDoneEditing,
    showAppliesTo = true,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onReorderDrop,
  } = props

  const { state } = useEditor()
  const project = state.project
  const ifLines = conditionsPlainList(event, project)
  const execBadge = triggerExecutionBadge(event, board, project)
  const appliesTo =
    board && project ? rulesheetAppliesToLabel(project, board) : null
  const dim = event.enabled ? '' : 'opacity-50'
  const isHighlighted = editing || selected
  const zapTooltip = zapTriggerTooltip(execBadge.label)

  const headerProps = {
    event,
    project,
    showAppliesTo,
    appliesTo,
    dim,
    editing,
    zapTooltip,
    ruleSummary: eventTriggerSummaryPlain(event, project),
    onSelect,
    onOpenEdit,
    onToggleEnabled,
    onEdit,
    onClone,
    onDelete,
    selected,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
  }

  const collapsedSelectTitle = editing ? undefined : 'Double-click to edit rule'
  const ruleSummary = eventTriggerSummaryPlain(event, project)
  const editorRegionId = `logic-rule-editor-${event.id}`

  const onDragOverCard = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(LOGIC_EVENT_DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const onDropCard = (e: DragEvent) => {
    const draggedId = e.dataTransfer.getData(LOGIC_EVENT_DRAG_MIME)
    if (!draggedId || draggedId === event.id) return
    e.preventDefault()
    onReorderDrop?.(draggedId)
  }

  return (
    <div
      data-logic-event-id={event.id}
      role="listitem"
      aria-selected={selected ?? false}
      aria-expanded={editing}
      aria-controls={editing ? editorRegionId : undefined}
      tabIndex={selected && !editing ? 0 : undefined}
      onDragOver={onReorderDrop ? onDragOverCard : undefined}
      onDrop={onReorderDrop ? onDropCard : undefined}
      className={`mb-3 overflow-hidden border bg-[var(--panel)] transition-colors ${
        isHighlighted ? 'border-[var(--accent-2)]' : 'border-[var(--border)]'
      }`}
    >
      {onReorderDrop && (
        <div
          className="flex cursor-grab items-center justify-center border-b border-[var(--border)] bg-[var(--panel-3)] py-0.5 text-[var(--muted)] active:cursor-grabbing"
          draggable
          title="Drag to reorder rule"
          onDragStart={(e) => {
            e.dataTransfer.setData(LOGIC_EVENT_DRAG_MIME, event.id)
            e.dataTransfer.effectAllowed = 'move'
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} aria-hidden />
        </div>
      )}
      <EventCardHeader {...headerProps} />

      {editing ? (
        <div id={editorRegionId}>
          <EventEditor
            event={event}
            board={board}
            project={project}
            onChange={onChange}
            onDone={onDoneEditing}
          />
        </div>
      ) : (
        <CardSelectButton
          className={`cursor-pointer ${dim}`}
          onSelect={onSelect}
          onDoubleClick={onOpenEdit}
          title={collapsedSelectTitle}
          ariaLabel={ruleSummary}
        >
          <div
            className={`grid grid-cols-1 border-b border-[var(--border)] ${
              ifLines.length > 0 ? 'lg:grid-cols-[minmax(220px,0.38fr)_1fr]' : ''
            }`}
          >
            {ifLines.length > 0 && (
              <EventCardConditions eventId={event.id} lines={ifLines} />
            )}
            <EventCardActions eventId={event.id} actions={event.actions} project={project} />
          </div>
        </CardSelectButton>
      )}
    </div>
  )
}
