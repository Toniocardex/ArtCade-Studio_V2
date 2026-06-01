import { describe, expect, it, vi } from 'vitest'

vi.mock('../keyboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../keyboard')>()
  return { ...actual, shouldIgnoreEditorShortcut: () => false }
})
import { createLogicBoardForObjectType, createLogicEvent } from './factory'
import {
  findEventInBoards,
  handleLogicBoardKey,
  type LogicBoardKeyHandlers,
} from './logic-board-keyboard'

function key(
  init: Partial<KeyboardEvent> & { key: string },
): KeyboardEvent {
  return {
    key: init.key,
    code: init.code ?? init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false,
    preventDefault: () => {},
    ...init,
  } as KeyboardEvent
}

function baseHandlers(
  overrides: Partial<LogicBoardKeyHandlers> = {},
): LogicBoardKeyHandlers {
  const board = createLogicBoardForObjectType('Player', 'pc')
  const a = createLogicEvent({ type: 'onStart' }, [])
  const b = createLogicEvent({ type: 'onUpdate' }, [])
  board.events = [a, b]
  return {
    sceneBoards: [board],
    activeBoard: board,
    focusedEventId: a.id,
    editingId: null,
    clipboard: null,
    copyEvent: vi.fn(),
    pasteEvent: vi.fn(),
    cloneEvent: vi.fn(),
    openFocusedForEdit: vi.fn(),
    closeEditor: vi.fn(),
    focusEvent: vi.fn(),
    deleteFocusedEvent: vi.fn(),
    moveFocusedEvent: vi.fn(),
    ...overrides,
  }
}

describe('findEventInBoards', () => {
  it('returns board and event by id', () => {
    const board = createLogicBoardForObjectType('P', 'pc')
    const ev = createLogicEvent({ type: 'onStart' }, [])
    board.events = [ev]
    expect(findEventInBoards([board], ev.id)?.event.id).toBe(ev.id)
  })
})

describe('handleLogicBoardKey', () => {
  it('calls deleteFocusedEvent on Delete when not editing', () => {
    const deleteFocusedEvent = vi.fn()
    const h = baseHandlers({ deleteFocusedEvent })
    handleLogicBoardKey(key({ key: 'Delete' }), h)
    expect(deleteFocusedEvent).toHaveBeenCalledOnce()
  })

  it('does not delete while inline editor is open', () => {
    const deleteFocusedEvent = vi.fn()
    const h = baseHandlers({ deleteFocusedEvent })
    const board = h.sceneBoards[0]!
    handleLogicBoardKey(key({ key: 'Delete' }), {
      ...h,
      editingId: board.events[0]!.id,
    })
    expect(deleteFocusedEvent).not.toHaveBeenCalled()
  })

  it('navigates selection with arrow keys', () => {
    const focusEvent = vi.fn()
    const h = baseHandlers({ focusEvent })
    handleLogicBoardKey(key({ key: 'ArrowDown' }), h)
    expect(focusEvent).toHaveBeenCalledWith(h.sceneBoards[0]!.events[1]!.id)
  })

  it('pastes when clipboard has an event', () => {
    const pasteEvent = vi.fn()
    const board = createLogicBoardForObjectType('P', 'pc')
    const ev = createLogicEvent({ type: 'onStart' }, [])
    board.events = [ev]
    handleLogicBoardKey(
      key({ key: 'v', ctrlKey: true }),
      baseHandlers({
        sceneBoards: [board],
        activeBoard: board,
        focusedEventId: ev.id,
        clipboard: { kind: 'event', event: ev },
        pasteEvent,
      }),
    )
    expect(pasteEvent).toHaveBeenCalledWith(ev.id)
  })
})
