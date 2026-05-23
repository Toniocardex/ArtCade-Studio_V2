// ---------------------------------------------------------------------------
// One game rule rendered as a structured inspector-style card.
// Sections: header (trigger), ONLY IF (conditions), THEN (actions).
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react'
import { Zap } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import type { LogicEvent } from '../../types/logic-board'
import {
  actionSummaryPlain,
  conditionsPlainList,
  triggerExecutionBadge,
  triggerSummaryPlain,
} from './friendly-labels'
import type { LogicBoard } from '../../types/logic-board'
import LogicIconButton from '../../components/logic-board/LogicIconButton'
import EventEditor from './EventEditor'

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[var(--muted)] mb-1.5">
      {children}
    </div>
  )
}

export default function EventCard({
  event,
  board,
  editing,
  selected,
  onSelect,
  onToggleEnabled,
  onEdit,
  onClone,
  onDelete,
  onChange,
  onDoneEditing,
}: {
  event: LogicEvent
  board?: LogicBoard | null
  editing: boolean
  selected?: boolean
  onSelect?: () => void
  onToggleEnabled: () => void
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
  onChange: (e: LogicEvent) => void
  onDoneEditing: () => void
}) {
  const { state } = useEditor()
  const project = state.project
  const ifLines = conditionsPlainList(event, project)
  const execBadge = triggerExecutionBadge(event, board, project)
  const dim = event.enabled ? '' : 'opacity-50'
  const isHighlighted = editing || selected

  return (
    <div
      className={`bg-[var(--panel)] border mb-3 overflow-hidden transition-colors ${
        isHighlighted
          ? 'border-[var(--accent-2)]'
          : 'border-[var(--border)]'
      }`}
    >
      {/* ── HEADER: trigger sentence + controls ─────────────────────── */}
      <div
        className={`flex items-start gap-2.5 px-3 py-2 bg-[var(--panel-3)] border-b border-[var(--border)] cursor-pointer ${dim}`}
        onClick={() => onSelect?.()}
      >
        <div className="shrink-0 mt-[2px] text-[var(--accent)]" title="Trigger">
          <Zap size={13} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] leading-snug text-[var(--text)] font-medium">
            {triggerSummaryPlain(event.trigger, project)}
          </div>
          <div
            className="text-[9px] mt-0.5 text-[var(--muted)] uppercase tracking-wider"
            title={execBadge.title}
          >
            {execBadge.label === 'Polling'
              ? 'Polling — runs each frame'
              : execBadge.label === 'Event*'
                ? 'Event handler (may poll)'
                : 'Event handler'}
          </div>
        </div>

        {/* Toggle: enabled/disabled (navy when active per palette rules) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleEnabled()
          }}
          title={event.enabled ? 'Regola attiva' : 'Regola disattivata'}
          aria-label={event.enabled ? 'Regola attiva' : 'Regola disattivata'}
          className={`w-9 h-[18px] rounded relative transition-colors shrink-0 mt-0.5 ${
            event.enabled
              ? 'bg-[var(--accent-2)]'
              : 'bg-[var(--border-2)]'
          }`}
        >
          <span
            className={`absolute top-0.5 w-3.5 h-3.5 rounded transition-all ${
              event.enabled
                ? 'right-0.5 bg-[var(--text)]'
                : 'left-0.5 bg-[var(--muted)]'
            }`}
          />
        </button>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <LogicIconButton
            title="Modifica regola"
            ariaLabel="Modifica regola"
            active={editing}
            onClick={onEdit}
          >
            ✎
          </LogicIconButton>
          <LogicIconButton
            title="Clona regola"
            ariaLabel="Clona regola"
            onClick={onClone}
          >
            ⧉
          </LogicIconButton>
          <LogicIconButton
            title="Elimina regola"
            ariaLabel="Elimina regola"
            danger
            onClick={onDelete}
          >
            ⌦
          </LogicIconButton>
        </div>
      </div>

      {/* ── BODY: editor or read-only ONLY IF / THEN sections ──────── */}
      {editing ? (
        <EventEditor
          event={event}
          board={board}
          project={project}
          onChange={onChange}
          onDone={onDoneEditing}
        />
      ) : (
        <div
          className={`cursor-pointer ${dim}`}
          onClick={() => onSelect?.()}
        >
          {ifLines.length > 0 && (
            <div className="px-3 py-2.5 border-b border-[var(--border)]">
              <SectionLabel>Only if</SectionLabel>
              <ul className="flex flex-col gap-1 list-none m-0 p-0">
                {ifLines.map((line, i) => (
                  <li
                    key={i}
                    className="text-xs text-[var(--text)] pl-3 relative leading-snug"
                  >
                    <span
                      className="absolute left-0 top-[7px] w-1 h-1 bg-[var(--muted)]"
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="px-3 py-2.5 relative">
            <span
              className="absolute left-0 top-2.5 bottom-2.5 w-[2px] bg-[var(--accent)]"
              aria-hidden="true"
            />
            <div className="pl-2">
              <SectionLabel>Then</SectionLabel>
              {event.actions.length === 0 ? (
                <span className="text-xs text-[var(--muted-2)] italic">
                  No actions yet
                </span>
              ) : (
                <ol className="flex flex-col gap-1 list-none m-0 p-0">
                  {event.actions.map((a, i) => (
                    <li
                      key={i}
                      className="text-xs text-[var(--text)] pl-5 relative leading-snug"
                    >
                      <span
                        className="absolute left-0 top-0 text-[10px] font-semibold text-[var(--muted)] tabular-nums"
                        aria-hidden="true"
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {actionSummaryPlain(a, project)}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
