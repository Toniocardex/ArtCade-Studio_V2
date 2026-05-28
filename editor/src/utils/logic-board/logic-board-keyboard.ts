// ---------------------------------------------------------------------------
// Logic Board rule list — keyboard shortcuts (visual editor).
// ---------------------------------------------------------------------------

import {
  isBackspaceKey,
  isDeleteKey,
  shouldIgnoreEditorShortcut,
} from '../keyboard'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import { navigableBoardEvents, siblingEventId } from './logic-event-list-ui'

export type LogicClipboard = { kind: 'event'; event: LogicEvent } | null

export function findEventInBoards(
  boards: readonly LogicBoard[],
  eventId: string | null,
): { board: LogicBoard; event: LogicEvent } | undefined {
  if (eventId == null) return undefined
  for (const board of boards) {
    const event = board.events.find((ev) => ev.id === eventId)
    if (event) return { board, event }
  }
  return undefined
}

function hasNonEmptyTextSelection(): boolean {
  const sel = globalThis.getSelection?.()
  return Boolean(sel && sel.toString().length > 0)
}

export type LogicBoardKeyHandlers = {
  sceneBoards: LogicBoard[]
  activeBoard: LogicBoard | null
  focusedEventId: string | null
  editingId: string | null
  clipboard: LogicClipboard
  copyEvent: (ev: LogicEvent) => void
  pasteEvent: (afterEventId?: string) => void
  cloneEvent: (ev: LogicEvent, board?: LogicBoard) => void
  openFocusedForEdit: () => void
  closeEditor: () => void
  focusEvent: (eventId: string) => void
  deleteFocusedEvent: () => void
  moveFocusedEvent: (toIndex: number) => void
  undoLogic: () => void
  redoLogic: () => void
}

/** Returns true when the event was handled (caller may still rely on preventDefault inside). */
export function handleLogicBoardKey(e: KeyboardEvent, handlers: LogicBoardKeyHandlers): void {
  const {
    sceneBoards,
    activeBoard,
    focusedEventId,
    editingId,
    clipboard,
    copyEvent,
    pasteEvent,
    cloneEvent,
    openFocusedForEdit,
    closeEditor,
    focusEvent,
    deleteFocusedEvent,
    moveFocusedEvent,
    undoLogic,
    redoLogic,
  } = handlers
  if (shouldIgnoreEditorShortcut(e)) return

  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase()
    if (key === 'z' && !e.altKey) {
      e.preventDefault()
      if (e.shiftKey) redoLogic()
      else undoLogic()
      return
    }
    if (key === 'y' && !e.shiftKey) {
      e.preventDefault()
      redoLogic()
      return
    }
  }

  const focused = findEventInBoards(sceneBoards, focusedEventId)?.event

  if (
    !editingId &&
    focusedEventId &&
    (isDeleteKey(e) || isBackspaceKey(e)) &&
    !hasNonEmptyTextSelection()
  ) {
    e.preventDefault()
    deleteFocusedEvent()
    return
  }

  if (
    !editingId &&
    e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    focusedEventId &&
    (e.key === 'ArrowUp' || e.key === 'ArrowDown')
  ) {
    const hit = findEventInBoards(sceneBoards, focusedEventId)
    if (hit) {
      const idx = hit.board.events.findIndex((ev) => ev.id === focusedEventId)
      const to =
        e.key === 'ArrowDown'
          ? Math.min(idx + 1, hit.board.events.length - 1)
          : Math.max(idx - 1, 0)
      if (idx >= 0 && to !== idx) {
        e.preventDefault()
        moveFocusedEvent(to)
      }
    }
    return
  }

  if (
    !editingId &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    (e.key === 'ArrowUp' || e.key === 'ArrowDown')
  ) {
    const events = navigableBoardEvents(sceneBoards, activeBoard, focusedEventId)
    if (events.length > 0) {
      e.preventDefault()
      const nextId = siblingEventId(
        events,
        focusedEventId,
        e.key === 'ArrowDown' ? 'down' : 'up',
      )
      if (nextId) focusEvent(nextId)
    }
    return
  }

  if (e.key === 'Escape' && editingId) {
    e.preventDefault()
    closeEditor()
    return
  }

  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (!focused || hasNonEmptyTextSelection()) return
    if (editingId === focused.id) return
    e.preventDefault()
    openFocusedForEdit()
    return
  }

  if (!e.ctrlKey && !e.metaKey) return

  const key = e.key.toLowerCase()

  if (key === 'c') {
    if (!focused || hasNonEmptyTextSelection()) return
    e.preventDefault()
    copyEvent(focused)
    return
  }
  if (key === 'v') {
    if (clipboard?.kind !== 'event') return
    e.preventDefault()
    pasteEvent(focused?.id)
    return
  }
  if (key === 'd') {
    if (!focused) return
    e.preventDefault()
    const hit = findEventInBoards(sceneBoards, focusedEventId)
    cloneEvent(focused, hit?.board ?? activeBoard ?? undefined)
  }
}
