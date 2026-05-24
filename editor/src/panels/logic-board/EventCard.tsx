// ---------------------------------------------------------------------------
// One game rule rendered as a structured inspector-style card.
// Sections: header (trigger), ONLY IF (conditions), THEN (actions).
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react'
import {
  CheckCircle2,
  Copy,
  GitBranch,
  ListChecks,
  Pencil,
  Trash2,
  Zap,
} from 'lucide-react'
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
    <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
      {children}
    </div>
  )
}

function SummaryChip({
  children,
  title,
  tone = 'neutral',
}: {
  children: ReactNode
  title?: string
  tone?: 'neutral' | 'ok' | 'warn'
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)]'
      : tone === 'warn'
        ? 'border-[rgba(var(--warn-rgb),0.45)] bg-[rgba(var(--warn-rgb),0.08)] text-[var(--warn)]'
        : 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)]'

  return (
    <span
      title={title}
      className={`inline-flex h-5 items-center gap-1 border px-1.5 text-[10px] leading-none ${toneClass}`}
    >
      {children}
    </span>
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
  const actionCount = event.actions.length
  const conditionCount = ifLines.length
  const hasActions = actionCount > 0

  return (
    <div
      className={`mb-3 overflow-hidden border bg-[var(--panel)] transition-colors ${
        isHighlighted
          ? 'border-[var(--accent-2)]'
          : 'border-[var(--border)]'
      }`}
    >
      <div
        className={`flex cursor-pointer items-start gap-2.5 border-b border-[var(--border)] bg-[var(--panel-3)] px-3 py-2.5 ${dim}`}
        onClick={() => onSelect?.()}
      >
        <div className="mt-[2px] shrink-0 text-[var(--accent)]" title="Trigger">
          <Zap size={13} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium leading-snug text-[var(--text)]">
            {triggerSummaryPlain(event.trigger, project)}
          </div>
          <div
            className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--muted)]"
            title={execBadge.title}
          >
            {execBadge.label === 'Polling'
              ? 'Polling - runs each frame'
              : execBadge.label === 'Event*'
                ? 'Event handler (may poll)'
                : 'Event handler'}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SummaryChip title="Checks required before actions run">
              <ListChecks size={11} />
              {conditionCount === 0
                ? 'Always'
                : `${conditionCount} check${conditionCount === 1 ? '' : 's'}`}
            </SummaryChip>
            <SummaryChip
              title="Actions in this rule"
              tone={hasActions ? 'ok' : 'warn'}
            >
              <GitBranch size={11} />
              {hasActions
                ? `${actionCount} action${actionCount === 1 ? '' : 's'}`
                : 'Needs action'}
            </SummaryChip>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleEnabled()
          }}
          title={event.enabled ? 'Regola attiva' : 'Regola disattivata'}
          aria-label={event.enabled ? 'Regola attiva' : 'Regola disattivata'}
          className={`relative mt-0.5 h-[18px] w-9 shrink-0 rounded transition-colors ${
            event.enabled
              ? 'bg-[var(--accent)]'
              : 'bg-[var(--border-2)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-3.5 w-3.5 rounded transition-all ${
              event.enabled
                ? 'right-0.5 bg-[var(--text)]'
                : 'left-0.5 bg-[var(--muted)]'
            }`}
          />
        </button>

        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <LogicIconButton
            title="Modifica regola"
            ariaLabel="Modifica regola"
            active={editing}
            onClick={onEdit}
          >
            <Pencil size={13} />
          </LogicIconButton>
          <LogicIconButton
            title="Clona regola"
            ariaLabel="Clona regola"
            onClick={onClone}
          >
            <Copy size={13} />
          </LogicIconButton>
          <LogicIconButton
            title="Elimina regola"
            ariaLabel="Elimina regola"
            danger
            onClick={onDelete}
          >
            <Trash2 size={13} />
          </LogicIconButton>
        </div>
      </div>

      {editing ? (
        <EventEditor
          event={event}
          board={board}
          project={project}
          onChange={onChange}
          onDone={onDoneEditing}
        />
      ) : (
        <div className={`cursor-pointer ${dim}`} onClick={() => onSelect?.()}>
          <div className="grid grid-cols-1 border-b border-[var(--border)] lg:grid-cols-[minmax(220px,0.38fr)_1fr]">
            <div className="border-b border-[var(--border)] bg-[rgba(var(--bg-rgb),0.25)] px-3 py-2.5 lg:border-b-0 lg:border-r">
              <SectionLabel>Only if</SectionLabel>
              {ifLines.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs leading-snug text-[var(--muted)]">
                  <CheckCircle2 size={12} className="text-[var(--accent)]" />
                  Always runs when triggered
                </div>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {ifLines.map((line, i) => (
                    <li
                      key={i}
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
              )}
            </div>

            <div className="relative px-3 py-2.5">
              <span
                className="absolute bottom-2.5 left-0 top-2.5 w-[2px] bg-[var(--accent)]"
                aria-hidden="true"
              />
              <div className="pl-2">
                <SectionLabel>Then</SectionLabel>
                {event.actions.length === 0 ? (
                  <span className="text-xs italic text-[var(--muted-2)]">
                    No actions yet
                  </span>
                ) : (
                  <ol className="m-0 flex list-none flex-col gap-1 p-0">
                    {event.actions.map((a, i) => (
                      <li
                        key={i}
                        className="relative pl-5 text-xs leading-snug text-[var(--text)]"
                      >
                        <span
                          className="absolute left-0 top-0 text-[10px] font-semibold tabular-nums text-[var(--muted)]"
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
        </div>
      )}
    </div>
  )
}
