// ---------------------------------------------------------------------------
// LogicRulesList — the rules of a rulesheet as accordion cards, in execution
// order. Collapsed: one summary row with inline actions. Focused: the full
// EventEditor expands in place, so everything stays on one surface.
// ---------------------------------------------------------------------------

import type { Dispatch } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Copy, Trash2, Zap } from 'lucide-react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import EventEditor from './EventEditor'
import LogicIconButton from '../../components/logic-board/LogicIconButton'
import { eventTriggerSummaryPlain, ruleSentenceParts } from './friendly-labels'
import { eventVisualGroup } from '../../utils/logic-board/event-visual-group'

export type LogicRulesListProps = Readonly<{
  project: ProjectDoc
  board: LogicBoard
  focusedEventId: string | null
  setFocusedEventId: (id: string | null) => void
  dispatch: Dispatch<Action>
  onPatchEvent: (event: LogicEvent) => void
  onCloneEvent: (event: LogicEvent, board: LogicBoard) => void
  onDeleteEvent: (event: LogicEvent, board: LogicBoard) => void
  onMoveEvent: (board: LogicBoard, eventId: string, toIndex: number) => void
}>

function RuleCardHeader({
  event,
  index,
  total,
  board,
  project,
  expanded,
  onToggle,
  dispatch,
  onCloneEvent,
  onDeleteEvent,
  onMoveEvent,
}: Readonly<{
  event: LogicEvent
  index: number
  total: number
  board: LogicBoard
  project: ProjectDoc
  expanded: boolean
  onToggle: () => void
  dispatch: Dispatch<Action>
  onCloneEvent: (event: LogicEvent, board: LogicBoard) => void
  onDeleteEvent: (event: LogicEvent, board: LogicBoard) => void
  onMoveEvent: (board: LogicBoard, eventId: string, toIndex: number) => void
}>) {
  const group = eventVisualGroup(event)
  const sentence = expanded ? null : ruleSentenceParts(event, project)

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 ${
        expanded
          ? 'border-b border-[var(--outline)] bg-[var(--surface-2)]'
          : 'hover:bg-[var(--surface-hover)]'
      } ${event.enabled ? '' : 'opacity-50'}`}
    >
      <button
        type="button"
        onClick={onToggle}
        title={expanded ? 'Collapse rule' : 'Edit rule'}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown size={12} className="shrink-0 text-[var(--muted)]" aria-hidden />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-[var(--muted)]" aria-hidden />
        )}
        <span className="w-5 shrink-0 font-mono text-[9px] text-[var(--muted)]">
          {String(index + 1).padStart(2, '0')}
        </span>
        <Zap size={11} className="shrink-0 text-[var(--accent)]" aria-hidden />
        {sentence ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] text-[var(--text)]">
              {sentence.when}
              {sentence.checks && (
                <span className="text-[var(--muted)]"> — {sentence.checks}</span>
              )}
            </span>
            {sentence.missingActions ? (
              <span className="block truncate text-[10px] text-[var(--warn)]">
                No actions yet — open the rule to add one
              </span>
            ) : (
              <span
                className="block truncate text-[10px] text-[var(--muted)]"
                title={sentence.actions}
              >
                → {sentence.actions}
              </span>
            )}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text)]">
            {eventTriggerSummaryPlain(event, project)}
          </span>
        )}
        <span className="hidden shrink-0 rounded border border-[var(--outline-subtle)] px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-[var(--muted)] sm:inline">
          {group}
        </span>
      </button>

      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={event.enabled}
          className={`relative h-[14px] w-7 shrink-0 rounded transition-colors ${
            event.enabled ? 'bg-[var(--outline-focus)]' : 'bg-[var(--outline)]'
          }`}
          title={event.enabled ? 'Disable rule' : 'Enable rule'}
          onClick={() =>
            dispatch({
              type: 'LOGIC_UPDATE_EVENT',
              boardId: board.boardId,
              event: { ...event, enabled: !event.enabled },
            })
          }
        >
          <span
            className={`absolute top-0.5 h-2.5 w-2.5 rounded bg-[var(--text)] transition-all ${
              event.enabled ? 'right-0.5' : 'left-0.5 opacity-50'
            }`}
          />
        </button>
        <LogicIconButton
          title="Move rule up"
          ariaLabel="Move rule up"
          disabled={index <= 0}
          onClick={() => onMoveEvent(board, event.id, index - 1)}
        >
          <ChevronUp size={12} />
        </LogicIconButton>
        <LogicIconButton
          title="Move rule down"
          ariaLabel="Move rule down"
          disabled={index >= total - 1}
          onClick={() => onMoveEvent(board, event.id, index + 1)}
        >
          <ChevronDown size={12} />
        </LogicIconButton>
        <LogicIconButton
          title="Clone rule"
          ariaLabel="Clone rule"
          onClick={() => onCloneEvent(event, board)}
        >
          <Copy size={12} />
        </LogicIconButton>
        <LogicIconButton
          title="Delete rule"
          ariaLabel="Delete rule"
          danger
          onClick={() => onDeleteEvent(event, board)}
        >
          <Trash2 size={12} />
        </LogicIconButton>
      </span>
    </div>
  )
}

export function LogicRulesList({
  project,
  board,
  focusedEventId,
  setFocusedEventId,
  dispatch,
  onPatchEvent,
  onCloneEvent,
  onDeleteEvent,
  onMoveEvent,
}: LogicRulesListProps) {
  return (
    <div className="flex flex-col gap-2">
      {board.events.map((event, index) => {
        const expanded = event.id === focusedEventId
        return (
          <div
            key={event.id}
            data-logic-event-id={event.id}
            className={`overflow-hidden rounded-[var(--radius-md)] border bg-[var(--surface)] ${
              expanded
                ? 'border-[var(--accent-bd)] shadow-[0_12px_30px_rgb(0_0_0_/_0.2)]'
                : 'border-[var(--outline)]'
            }`}
          >
            <RuleCardHeader
              event={event}
              index={index}
              total={board.events.length}
              board={board}
              project={project}
              expanded={expanded}
              onToggle={() => setFocusedEventId(expanded ? null : event.id)}
              dispatch={dispatch}
              onCloneEvent={onCloneEvent}
              onDeleteEvent={onDeleteEvent}
              onMoveEvent={onMoveEvent}
            />
            {expanded && (
              <div className="p-3">
                <EventEditor
                  event={event}
                  board={board}
                  project={project}
                  onChange={onPatchEvent}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
