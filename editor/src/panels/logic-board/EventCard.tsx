// ---------------------------------------------------------------------------
// One game rule: collapsed plain-English summary or expanded editor
// ---------------------------------------------------------------------------

import { useEditor } from '../../store/editor-store'
import type { LogicEvent } from '../../types/logic-board'
import {
  actionSummaryPlain,
  conditionsPlainList,
  triggerSummaryPlain,
} from './friendly-labels'
import { RuleSentence } from '../../components/logic-board/RuleSentence'
import EventEditor from './EventEditor'

const pill =
  'text-[11px] font-bold px-2 py-0.5 rounded border tracking-wide shrink-0'
const pWhen = 'text-[var(--accent)] border-[var(--accent-bd)] bg-[var(--accent-bg)]'
const pIf = 'text-[var(--yellow)] border-[var(--pill-if-bd)] bg-[var(--pill-if-bg)]'
const pThen = 'text-[var(--warn)] border-[var(--pill-then-bd)] bg-[var(--pill-then-bg)]'

export default function EventCard({
  event,
  editing,
  onToggleEnabled,
  onEdit,
  onDelete,
  onChange,
  onDoneEditing,
}: {
  event: LogicEvent
  editing: boolean
  onToggleEnabled: () => void
  onEdit: () => void
  onDelete: () => void
  onChange: (e: LogicEvent) => void
  onDoneEditing: () => void
}) {
  const { state } = useEditor()
  const project = state.project
  const ifLines = conditionsPlainList(event, project)
  const dim = event.enabled ? '' : 'opacity-50'

  return (
    <div
      className={`bg-[var(--panel)] border rounded-lg mb-3 overflow-hidden ${
        editing ? 'border-[var(--accent)]' : 'border-[var(--border)]'
      }`}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5 bg-[var(--panel-3)] border-b border-[var(--border)]">
        <span className={`${pill} ${pWhen}`}>When</span>
        <RuleSentence text={triggerSummaryPlain(event.trigger, project)} dimmed={!event.enabled} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={onToggleEnabled}
          title={event.enabled ? 'Rule on' : 'Rule off'}
          aria-label={event.enabled ? 'Rule on' : 'Rule off'}
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
        <button
          type="button"
          onClick={onEdit}
          className={`w-7 h-7 rounded border flex items-center justify-center text-xs shrink-0 ${
            editing
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--text)]'
          }`}
          title="Edit rule"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-7 h-7 rounded border border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--danger)] flex items-center justify-center text-xs shrink-0"
          title="Delete rule"
        >
          ⌦
        </button>
      </div>

      {editing ? (
        <EventEditor event={event} onChange={onChange} onDone={onDoneEditing} />
      ) : (
        <div className={`px-3 py-2.5 space-y-2 ${dim}`}>
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
