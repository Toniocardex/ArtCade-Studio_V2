import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { eventTriggerSummaryPlain } from './friendly-labels'
import { Zap } from 'lucide-react'

export type LogicEventRowProps = Readonly<{
  event: LogicEvent
  index: number
  board: LogicBoard
  project: ProjectDoc
  selected: boolean
  onSelect: () => void
}>

/** Compact event summary for the Logic Board left column. */
export function LogicEventRow({
  event,
  index,
  project,
  selected,
  onSelect,
}: LogicEventRowProps) {
  return (
    <button
      type="button"
      data-logic-event-id={event.id}
      onClick={onSelect}
      className={`w-full text-left px-2 py-2 border-b border-[var(--outline-subtle)] transition-colors ${
        selected
          ? 'bg-[var(--accent-muted)] text-[var(--primary)]'
          : 'text-[var(--primary-soft)] hover:bg-[var(--outline-faint)]'
      } ${event.enabled ? '' : 'opacity-50'}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-[9px] font-mono text-[var(--muted)] mt-0.5 w-4 shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <Zap size={11} className="shrink-0 mt-0.5 text-[var(--accent)]" aria-hidden />
        <span className="text-[10px] leading-snug line-clamp-2">
          {eventTriggerSummaryPlain(event, project)}
        </span>
      </div>
    </button>
  )
}
