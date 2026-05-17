// ---------------------------------------------------------------------------
// One LogicEvent rendered as a card: collapsed summary (WHEN/IF/THEN) or,
// when expanded, the inline EventEditor.
// ---------------------------------------------------------------------------

import type { LogicEvent } from '../../types/logic-board'
import { actionSummary, conditionSummary, triggerSummary } from './options'
import EventEditor from './EventEditor'

const pill =
  'text-[11px] font-bold px-2 py-0.5 rounded border tracking-wide'
const pWhen = 'text-[#00FFFF] border-[#0a5a5a] bg-[#062a2a]'
const pIf = 'text-[#FBBF24] border-[#7a5a12] bg-[#2a2008]'
const pThen = 'text-[#F97316] border-[#7a3d12] bg-[#2a1608]'

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
      className={`bg-[#111827] border rounded-lg mb-3 overflow-hidden ${
        editing ? 'border-[#00FFFF]' : 'border-[#1A253A]'
      }`}
    >
      {/* header */}
      <div className="flex items-center gap-2.5 px-3 py-2 bg-[#1A253A] border-b border-[#1A253A]">
        <span className={`${pill} ${pWhen}`}>WHEN</span>
        <span className={`text-[#D1D5DB] font-semibold text-sm ${dim}`}>
          {triggerSummary(event.trigger)}
        </span>
        <div className="flex-1" />
        <button
          onClick={onToggleEnabled}
          title={event.enabled ? 'enabled' : 'disabled'}
          className={`w-9 h-[18px] rounded-full relative transition-colors ${
            event.enabled ? 'bg-[#0a5a5a]' : 'bg-[#2D3748]'
          }`}
        >
          <span
            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${
              event.enabled
                ? 'right-0.5 bg-[#00FFFF]'
                : 'left-0.5 bg-[#9CA3AF]'
            }`}
          />
        </button>
        <button
          onClick={onEdit}
          className={`w-6 h-6 rounded border flex items-center justify-center text-xs ${
            editing
              ? 'border-[#00FFFF] text-[#00FFFF]'
              : 'border-[#2D3748] text-[#9CA3AF] hover:text-[#D1D5DB]'
          }`}
          title="edit"
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          className="w-6 h-6 rounded border border-[#2D3748] text-[#9CA3AF] hover:text-[#F87171] flex items-center justify-center text-xs"
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
                    className="text-[11px] px-2 py-0.5 rounded bg-[#1A253A] border border-[#2D3748] text-[#D1D5DB]"
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
                <span className="text-[11px] text-[#5b6b82]">
                  (no actions)
                </span>
              ) : (
                event.actions.map((a, i) => (
                  <span key={i} className="text-xs text-[#D1D5DB]">
                    <span className="text-[#F97316] font-semibold">
                      {a.type}
                    </span>{' '}
                    <span className="text-[#9CA3AF]">
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
