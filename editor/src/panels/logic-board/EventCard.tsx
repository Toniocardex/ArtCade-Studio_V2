// ---------------------------------------------------------------------------
// One LogicEvent rendered as a card: collapsed summary (WHEN/IF/THEN) or,
// when expanded, the inline EventEditor.
// ---------------------------------------------------------------------------

import type { LogicEvent } from '../../types/logic-board'
import { actionSummary, conditionSummary, triggerSummary } from './options'
import EventEditor from './EventEditor'

const pill =
  'text-[11px] font-bold px-2 py-0.5 rounded border tracking-wide'
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
  const conditions = event.conditions ?? []
  const dim = event.enabled ? '' : 'opacity-50'

  return (
    <div
      className={`bg-[var(--panel)] border rounded-lg mb-3 overflow-hidden ${
        editing ? 'border-[var(--accent)]' : 'border-[var(--border)]'
      }`}
    >
      {/* header */}
      <div className="flex items-center gap-2.5 px-3 py-2 bg-[var(--border)] border-b border-[var(--border)]">
        <span className={`${pill} ${pWhen}`}>WHEN</span>
        <span className={`text-[var(--text)] font-semibold text-sm ${dim}`}>
          {triggerSummary(event.trigger)}
        </span>
        <div className="flex-1" />
        <button
          onClick={onToggleEnabled}
          title={event.enabled ? 'enabled' : 'disabled'}
          className={`w-9 h-[18px] rounded-full relative transition-colors ${
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
          onClick={onEdit}
          className={`w-6 h-6 rounded border flex items-center justify-center text-xs ${
            editing
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--text)]'
          }`}
          title="edit"
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          className="w-6 h-6 rounded border border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--danger)] flex items-center justify-center text-xs"
          title="delete"
        >
          ⌦
        </button>
      </div>

      {editing ? (
        <EventEditor event={event} onChange={onChange} onDone={onDoneEditing} />
      ) : (
        <div className={`px-3 py-2 space-y-1.5 ${dim}`}>
          {conditions.length > 0 && (
            <div className="flex items-start gap-2 pt-1">
              <span className={`${pill} ${pIf}`}>IF</span>
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((c, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded bg-[var(--border)] border border-[var(--border-2)] text-[var(--text)]"
                  >
                    {conditionSummary(c)}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 pt-1">
            <span className={`${pill} ${pThen}`}>THEN</span>
            <div className="flex flex-col gap-0.5">
              {event.actions.length === 0 ? (
                <span className="text-[11px] text-[var(--muted-2)]">
                  (no actions)
                </span>
              ) : (
                event.actions.map((a, i) => (
                  <span key={i} className="text-xs text-[var(--text)]">
                    <span className="text-[var(--warn)] font-semibold">
                      {a.type}
                    </span>{' '}
                    <span className="text-[var(--muted)]">
                      {actionSummary(a).replace(/^\S+\s?/, '')}
                    </span>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
