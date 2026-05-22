// ---------------------------------------------------------------------------
// One game rule: collapsed plain-English summary or expanded editor
// ---------------------------------------------------------------------------

import { useEditor } from '../../store/editor-store'
import type { LogicEvent } from '../../types/logic-board'
import {
  actionSummaryPlain,
  conditionsPlainList,
  triggerExecutionBadge,
  triggerSummaryPlain,
} from './friendly-labels'
import type { LogicBoard } from '../../types/logic-board'
import { RuleSentence } from '../../components/logic-board/RuleSentence'
import LogicIconButton from '../../components/logic-board/LogicIconButton'
import EventEditor from './EventEditor'

const pill =
  'text-[11px] font-bold px-2 py-0.5 rounded border tracking-wide shrink-0'
const pWhen = 'text-[var(--accent)] border-[var(--accent-bd)] bg-[var(--accent-bg)]'
const pIf = 'text-[var(--yellow)] border-[var(--pill-if-bd)] bg-[var(--pill-if-bg)]'
const pThen = 'text-[var(--warn)] border-[var(--pill-then-bd)] bg-[var(--pill-then-bg)]'

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
  const dim = event.enabled ? '' : 'opacity-50'
  const execBadge = triggerExecutionBadge(event, board, project)

  return (
    <div
      className={`bg-[var(--panel)] border rounded-lg mb-3 overflow-hidden ${
        editing || selected ? 'border-[var(--accent)]' : 'border-[var(--border)]'
      }`}
    >
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 bg-[var(--panel-3)] border-b border-[var(--border)] cursor-pointer"
        onClick={() => onSelect?.()}
      >
        <span className={`${pill} ${pWhen}`}>When</span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
            execBadge.label === 'Polling'
              ? 'text-[var(--muted)] border-[var(--border-2)] bg-[var(--panel-2)]'
              : 'text-[var(--accent)] border-[var(--accent-bd)] bg-[var(--accent-bg)]'
          }`}
          title={execBadge.title}
        >
          {execBadge.label}
        </span>
        <RuleSentence text={triggerSummaryPlain(event.trigger, project)} dimmed={!event.enabled} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleEnabled()
          }}
          title={event.enabled ? 'Regola attiva' : 'Regola disattivata'}
          aria-label={event.enabled ? 'Regola attiva' : 'Regola disattivata'}
          className={`w-9 h-[18px] rounded-full relative transition-colors shrink-0 ${
            event.enabled ? 'bg-[var(--accent-bd)]' : 'bg-[var(--border-2)]'
          }`}
        >
          <span
            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${
              event.enabled
                ? 'right-0.5 bg-[var(--accent)]'
                : 'left-0.5 bg-[var(--muted)]'
            }`}
          />
        </button>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
          className={`px-3 py-2.5 space-y-2 cursor-pointer ${dim}`}
          onClick={() => onSelect?.()}
        >
          {ifLines.length > 0 && (
            <div className="flex items-start gap-2">
              <span className={`${pill} ${pIf}`}>Only if</span>
              <ul className="flex flex-col gap-1 list-none m-0 p-0">
                {ifLines.map((line, i) => (
                  <li
                    key={i}
                    className="text-xs text-[var(--text)] pl-0 before:content-['•'] before:mr-1.5 before:text-[var(--muted)]"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-start gap-2">
            <span className={`${pill} ${pThen}`}>Then</span>
            {event.actions.length === 0 ? (
              <span className="text-xs text-[var(--muted-2)]">No actions yet</span>
            ) : (
              <ol className="flex flex-col gap-1 list-decimal list-inside m-0 p-0 text-xs text-[var(--text)]">
                {event.actions.map((a, i) => (
                  <li key={i}>{actionSummaryPlain(a, project)}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
