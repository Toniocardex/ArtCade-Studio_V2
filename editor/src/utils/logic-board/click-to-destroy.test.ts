import { describe, expect, it } from 'vitest'
import { compileLogicBoard } from './compiler'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import {
  clickToDestroySummary,
  createClickToDestroyEvent,
  isClickToDestroyEvent,
} from './click-to-destroy'

function board(events: LogicEvent[]): LogicBoard {
  return { boardId: 'b1', target: { type: 'entity_id', entityId: 1 }, events }
}

describe('click to destroy preset', () => {
  it('creates onObjectClick with preventDefault and destroy self', () => {
    const ev = createClickToDestroyEvent()
    expect(ev.trigger).toEqual({
      type: 'onObjectClick',
      button: 'right',
      radius: 32,
    })
    expect(ev.actions).toEqual([
      { type: 'preventDefault', button: 'right' },
      { type: 'destroyEntity', target: 'self' },
    ])
    expect(isClickToDestroyEvent(ev)).toBe(true)
    expect(clickToDestroySummary(ev)).toBe('Click to destroy (right mouse)')
  })

  it('isClickToDestroyEvent is false when actions are edited', () => {
    const ev = createClickToDestroyEvent()
    ev.actions.push({ type: 'debugLog', message: 'bye' })
    expect(isClickToDestroyEvent(ev)).toBe(false)
  })

  it('compiles to object click hit test and destroy self', () => {
    const lua = compileLogicBoard([board([createClickToDestroyEvent()])])
    expect(lua).toContain('input.mouseButtonDown(1)')
    expect(lua).toContain('input.preventDefault(1)')
    expect(lua).toContain('entity.destroy(self)')
  })
})
