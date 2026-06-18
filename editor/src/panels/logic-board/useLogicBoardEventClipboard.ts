import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../../store/editor-store'
import type { CoreState } from '../../store/editor-store-state'
import type { ProjectDoc } from '../../types'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import { cloneLogicEvent } from '../../utils/logic-board/clone'
import { eventCompatibilityError } from '../../utils/logic-board/trigger-compatibility'
import {
  focusIdAfterDelete,
  scrollLogicEventRowIntoViewSoon,
} from '../../utils/logic-board/logic-event-list-ui'
import {
  findEventInBoards,
  handleLogicBoardKey,
  type LogicClipboard,
} from '../../utils/logic-board/logic-board-keyboard'

type EditorDispatch = Dispatch<Action>

export type LogicBoardEventClipboard = Readonly<{
  focusedEventId: string | null
  editingId: string | null
  clipboardHint: string | null
  cloneEvent: (ev: LogicEvent, eventBoard?: LogicBoard) => void
  patchFocusedEvent: (event: LogicEvent) => void
  deleteEvent: (ev: LogicEvent, eventBoard: LogicBoard) => void
  moveEvent: (eventBoard: LogicBoard, eventId: string, toIndex: number) => void
  focusEventForLayout: (id: string | null) => void
}>

export function useLogicBoardEventClipboard(params: {
  project: ProjectDoc | null
  board: LogicBoard | null
  sceneBoards: LogicBoard[]
  mode: CoreState['mode']
  panelMode: 'visual' | 'lua'
  boardsRevision: string
  dispatch: EditorDispatch
  getState: () => CoreState
}): LogicBoardEventClipboard {
  const {
    project,
    board,
    sceneBoards,
    mode,
    panelMode,
    boardsRevision,
    dispatch,
    getState,
  } = params

  const [focusedEventId, setFocusedEventId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clipboardHint, setClipboardHint] = useState<string | null>(null)
  const clipboardRef = useRef<LogicClipboard>(null)
  const hintTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)

  useEffect(() => () => {
    if (hintTimerRef.current != null) globalThis.clearTimeout(hintTimerRef.current)
  }, [])

  const showClipboardHint = useCallback((msg: string) => {
    setClipboardHint(msg)
    if (hintTimerRef.current != null) globalThis.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = globalThis.setTimeout(() => setClipboardHint(null), 2000)
  }, [])

  const insertClonedEvent = useCallback(
    (
      source: LogicEvent,
      targetBoard: LogicBoard,
      afterEventId?: string,
      options?: { openEditor?: boolean },
    ) => {
      const copy = cloneLogicEvent(source)
      dispatch({
        type: 'LOGIC_INSERT_EVENT',
        boardId: targetBoard.boardId,
        event: copy,
        afterEventId,
      })
      setFocusedEventId(copy.id)
      if (options?.openEditor) setEditingId(copy.id)
      scrollLogicEventRowIntoViewSoon(copy.id)
      return copy
    },
    [dispatch],
  )

  const cloneEvent = useCallback(
    (ev: LogicEvent, eventBoard?: LogicBoard) => {
      const target = eventBoard ?? board
      if (!target) return
      insertClonedEvent(ev, target, ev.id)
    },
    [board, insertClonedEvent],
  )

  const copyEvent = useCallback(
    (ev: LogicEvent) => {
      clipboardRef.current = { kind: 'event', event: structuredClone(ev) }
      showClipboardHint('Rule copied')
    },
    [showClipboardHint],
  )

  const pasteEvent = useCallback(
    (afterEventId?: string) => {
      const clip = clipboardRef.current
      if (clip?.kind !== 'event') return
      const pasteBoard =
        findEventInBoards(sceneBoards, focusedEventId)?.board ?? board
      if (!pasteBoard) return
      const compat = eventCompatibilityError(clip.event, pasteBoard.target.type)
      if (compat) {
        showClipboardHint(compat)
        return
      }
      insertClonedEvent(
        clip.event,
        pasteBoard,
        afterEventId ?? focusedEventId ?? undefined,
      )
      showClipboardHint('Rule pasted into this rulesheet')
    },
    [board, sceneBoards, focusedEventId, insertClonedEvent, showClipboardHint],
  )

  const moveFocusedEvent = useCallback(
    (toIndex: number) => {
      const hit = findEventInBoards(sceneBoards, focusedEventId)
      if (!hit || focusedEventId == null) return
      dispatch({
        type: 'LOGIC_MOVE_EVENT',
        boardId: hit.board.boardId,
        eventId: focusedEventId,
        toIndex,
      })
      scrollLogicEventRowIntoViewSoon(focusedEventId)
    },
    [sceneBoards, focusedEventId, dispatch],
  )

  useEffect(() => {
    if (!project) return
    const liveBoards = getState().project?.logicBoards ?? []
    if (editingId != null && !findEventInBoards(liveBoards, editingId)) {
      setEditingId(null)
    }
    if (focusedEventId != null && !findEventInBoards(liveBoards, focusedEventId)) {
      setFocusedEventId(null)
    }
  }, [boardsRevision, project, editingId, focusedEventId, getState])

  const deleteFocusedEvent = useCallback(() => {
    const hit = findEventInBoards(sceneBoards, focusedEventId)
    if (!hit) return
    const { board: eventBoard, event } = hit
    const nextFocus = focusIdAfterDelete(eventBoard.events, event.id)
    dispatch({
      type: 'LOGIC_DELETE_EVENT',
      boardId: eventBoard.boardId,
      eventId: event.id,
    })
    if (editingId === event.id) setEditingId(null)
    setFocusedEventId(nextFocus)
    if (nextFocus) scrollLogicEventRowIntoViewSoon(nextFocus)
  }, [sceneBoards, focusedEventId, editingId, dispatch])

  useEffect(() => {
    if (mode !== 'logic' || panelMode !== 'visual') return
    if (sceneBoards.length === 0 && !board) return

    const onKeyDown = (e: KeyboardEvent) => {
      handleLogicBoardKey(e, {
        sceneBoards,
        activeBoard: board,
        focusedEventId,
        editingId,
        clipboard: clipboardRef.current,
        copyEvent,
        pasteEvent,
        cloneEvent,
        openFocusedForEdit: () => {
          if (focusedEventId == null) return
          setEditingId(focusedEventId)
        },
        closeEditor: () => {
          setEditingId(null)
          scrollLogicEventRowIntoViewSoon(focusedEventId)
        },
        focusEvent: (eventId) => {
          setFocusedEventId(eventId)
          scrollLogicEventRowIntoViewSoon(eventId)
        },
        deleteFocusedEvent,
        moveFocusedEvent,
      })
    }

    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [
    mode,
    panelMode,
    board,
    sceneBoards,
    focusedEventId,
    editingId,
    copyEvent,
    pasteEvent,
    cloneEvent,
    deleteFocusedEvent,
    moveFocusedEvent,
  ])

  const patchFocusedEvent = useCallback(
    (event: LogicEvent) => {
      if (!board) return
      dispatch({
        type: 'LOGIC_UPDATE_EVENT',
        boardId: board.boardId,
        event,
      })
    },
    [board, dispatch],
  )

  const deleteEvent = useCallback(
    (ev: LogicEvent, eventBoard: LogicBoard) => {
      const nextFocus = focusIdAfterDelete(eventBoard.events, ev.id)
      dispatch({
        type: 'LOGIC_DELETE_EVENT',
        boardId: eventBoard.boardId,
        eventId: ev.id,
      })
      if (editingId === ev.id) setEditingId(null)
      setFocusedEventId(nextFocus)
      if (nextFocus) scrollLogicEventRowIntoViewSoon(nextFocus)
    },
    [dispatch, editingId],
  )

  const moveEvent = useCallback(
    (eventBoard: LogicBoard, eventId: string, toIndex: number) => {
      dispatch({
        type: 'LOGIC_MOVE_EVENT',
        boardId: eventBoard.boardId,
        eventId,
        toIndex,
      })
      scrollLogicEventRowIntoViewSoon(eventId)
    },
    [dispatch],
  )

  const focusEventForLayout = useCallback((id: string | null) => {
    setFocusedEventId(id)
    setEditingId(id)
  }, [])

  return {
    focusedEventId,
    editingId,
    clipboardHint,
    cloneEvent,
    patchFocusedEvent,
    deleteEvent,
    moveEvent,
    focusEventForLayout,
  }
}
