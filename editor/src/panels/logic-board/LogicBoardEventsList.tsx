import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent, LogicTriggerType } from '../../types/logic-board'
import { TypePicker } from '../../components/logic-board/TypePicker'
import { createLogicEvent } from '../../utils/logic-board/factory'
import {
  logicBoardLabel,
  logicBoardsForScene,
  rulesheetAppliesToLabel,
} from '../../utils/project'
import EventCard from './EventCard'
import { defaultTrigger } from './options'
import { allowedTriggersForTarget } from '../../utils/logic-board/trigger-compatibility'
import { scrollEventCardIntoViewSoon } from '../../utils/logic-board/logic-event-list-ui'

/** Sentinel for the add-rule trigger picker before the user chooses a type. */
export const NEW_TRIGGER_NONE = '' as const
export type NewTriggerPick = LogicTriggerType | typeof NEW_TRIGGER_NONE

const addRuleBtn =
  'flex-1 min-w-[140px] px-3 py-2 rounded border border-dashed border-[var(--border-2)] text-xs'
const addRuleBtnEnabled =
  `${addRuleBtn} text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent-bd)]`
const addRuleBtnDisabled =
  `${addRuleBtn} text-[var(--muted)] opacity-50 cursor-not-allowed`

type LogicBoardEventsListProps = Readonly<{
  project: ProjectDoc
  board: LogicBoard | null
  sceneId: string
  clipboardHint: string | null
  editingId: string | null
  setEditingId: (id: string | null) => void
  focusedEventId: string | null
  setFocusedEventId: (id: string | null) => void
  newTrigger: NewTriggerPick
  setNewTrigger: (trigger: NewTriggerPick) => void
  onCloneEvent: (event: LogicEvent, board: LogicBoard) => void
  dispatch: Dispatch<Action>
}>

function renderEventCard(
  ev: LogicEvent,
  eventBoard: LogicBoard,
  props: LogicBoardEventsListProps,
  showAppliesTo: boolean,
) {
  const {
    editingId,
    setEditingId,
    focusedEventId,
    setFocusedEventId,
    onCloneEvent,
    dispatch,
  } = props

  const eventIndex = eventBoard.events.findIndex((e) => e.id === ev.id)
  const moveEvent = (toIndex: number) => {
    dispatch({
      type: 'LOGIC_MOVE_EVENT',
      boardId: eventBoard.boardId,
      eventId: ev.id,
      toIndex,
    })
    scrollEventCardIntoViewSoon(ev.id)
  }

  return (
    <EventCard
      event={ev}
      board={eventBoard}
      showAppliesTo={showAppliesTo}
      editing={editingId === ev.id}
      selected={focusedEventId === ev.id}
      onSelect={() => setFocusedEventId(ev.id)}
      onOpenEdit={() => {
        setFocusedEventId(ev.id)
        setEditingId(ev.id)
        scrollEventCardIntoViewSoon(ev.id)
      }}
      onToggleEnabled={() =>
        dispatch({
          type: 'LOGIC_UPDATE_EVENT',
          boardId: eventBoard.boardId,
          event: { ...ev, enabled: !ev.enabled },
        })
      }
      onEdit={() => {
        setFocusedEventId(ev.id)
        setEditingId(editingId === ev.id ? null : ev.id)
      }}
      onClone={() => onCloneEvent(ev, eventBoard)}
      onDelete={() => {
        dispatch({
          type: 'LOGIC_DELETE_EVENT',
          boardId: eventBoard.boardId,
          eventId: ev.id,
        })
        if (editingId === ev.id) setEditingId(null)
        if (focusedEventId === ev.id) setFocusedEventId(null)
      }}
      onChange={(next) =>
        dispatch({
          type: 'LOGIC_UPDATE_EVENT',
          boardId: eventBoard.boardId,
          event: next,
        })
      }
      onDoneEditing={() => setEditingId(null)}
      canMoveUp={eventIndex > 0}
      canMoveDown={eventIndex >= 0 && eventIndex < eventBoard.events.length - 1}
      onMoveUp={() => moveEvent(eventIndex - 1)}
      onMoveDown={() => moveEvent(eventIndex + 1)}
      onReorderDrop={(draggedEventId) => {
        const from = eventBoard.events.findIndex((e) => e.id === draggedEventId)
        const to = eventBoard.events.findIndex((e) => e.id === ev.id)
        if (from < 0 || to < 0) return
        dispatch({
          type: 'LOGIC_MOVE_EVENT',
          boardId: eventBoard.boardId,
          eventId: draggedEventId,
          toIndex: to,
        })
        scrollEventCardIntoViewSoon(draggedEventId)
      }}
    />
  )
}

export function LogicBoardEventsList(listProps: LogicBoardEventsListProps) {
  const {
    project,
    board,
    sceneId,
    clipboardHint,
    setEditingId,
    setFocusedEventId,
    newTrigger,
    setNewTrigger,
    dispatch,
  } = listProps
  const sceneBoards = logicBoardsForScene(project, sceneId)
  const groupedView = sceneBoards.length > 1
  const totalRules = sceneBoards.reduce((n, b) => n + b.events.length, 0)

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4" data-logic-events-list>
      {!board && sceneBoards.length === 0 ? (
        <div className="text-[var(--muted)] text-sm mt-8 text-center max-w-md mx-auto leading-relaxed">
          Select an entity in the Scenes panel, then create a rulesheet with{' '}
          <span className="text-[var(--text)]">New rulesheet for selection</span>.
        </div>
      ) : (
        <>
          <div className="text-xs text-[var(--muted)] mb-3 flex items-center gap-2 flex-wrap">
            {groupedView ? (
              <span>
                Rules in scene:{' '}
                <span className="text-[var(--text)] font-medium">
                  {sceneBoards.length} sheets, {totalRules} rules
                </span>
              </span>
            ) : (
              board && (
                <span>
                  Rules for{' '}
                  <span className="text-[var(--text)] font-medium">
                    {rulesheetAppliesToLabel(project, board)}
                  </span>{' '}
                  ({board.events.length})
                </span>
              )
            )}
            {clipboardHint && (
              <span className="text-[10px] text-[var(--accent)]">{clipboardHint}</span>
            )}
            <span className="text-[10px] text-[var(--muted-2)]">
              Double-click or Enter to edit · Ctrl+C copy · Ctrl+V paste · Ctrl+D duplicate
            </span>
          </div>

          {groupedView
            ? sceneBoards.map((eventBoard) => (
                <section key={eventBoard.boardId} className="mb-5 last:mb-0">
                  <div className="mb-2 flex items-center gap-2 border-b border-[var(--border)] pb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Applies to
                    </span>
                    <span
                      className="text-xs font-medium text-[var(--accent)]"
                      title={logicBoardLabel(project, eventBoard)}
                    >
                      {rulesheetAppliesToLabel(project, eventBoard)}
                    </span>
                    <span className="text-[10px] text-[var(--muted-2)]">
                      ({eventBoard.events.length})
                    </span>
                  </div>
                  {eventBoard.events.length === 0 ? (
                    <p className="text-[11px] italic text-[var(--muted-2)] mb-2">
                      No rules on this sheet yet.
                    </p>
                  ) : (
                    eventBoard.events.map((ev) => (
                      <div key={`${eventBoard.boardId}:${ev.id}`}>
                        {renderEventCard(ev, eventBoard, listProps, false)}
                      </div>
                    ))
                  )}
                </section>
              ))
            : board?.events.map((ev) => (
                <div key={`${board.boardId}:${ev.id}`}>
                  {renderEventCard(ev, board, listProps, true)}
                </div>
              ))}

          {board && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <TypePicker
                kind="trigger"
                types={allowedTriggersForTarget(board.target.type)}
                value={newTrigger}
                onChange={(t) => setNewTrigger(t as NewTriggerPick)}
                className="max-w-[240px]"
                placeholder="Select trigger…"
                placeholderValue={NEW_TRIGGER_NONE}
              />
              <button
                type="button"
                disabled={!newTrigger}
                title={
                  newTrigger
                    ? 'Add a new rule with the selected trigger'
                    : 'Choose a trigger from the list first'
                }
                onClick={() => {
                  if (!newTrigger) return
                  const ev = createLogicEvent(defaultTrigger(newTrigger))
                  dispatch({
                    type: 'LOGIC_ADD_EVENT',
                    boardId: board.boardId,
                    event: ev,
                  })
                  setFocusedEventId(ev.id)
                  scrollEventCardIntoViewSoon(ev.id)
                  setNewTrigger(NEW_TRIGGER_NONE)
                }}
                className={newTrigger ? addRuleBtnEnabled : addRuleBtnDisabled}
              >
                Add rule to {rulesheetAppliesToLabel(project, board)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
