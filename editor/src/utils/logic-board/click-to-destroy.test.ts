import { describe, expect, it } from 'vitest'
import { compileLogicBoard } from './compiler'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import {
  applyClickToDestroyTrigger,
  clickToDestroySummary,
  createClickToDestroyEvent,
  isClickToDestroyEvent,
} from './click-to-destroy'

function board(events: LogicEvent[]): LogicBoard {
  return { boardId: 'b1', target: { type: 'entity_id', entityId: 1 }, events }
}

describe('click to destroy action', () => {
  it('creates onObjectClick with clickToDestroy action', () => {
    const ev = createClickToDestroyEvent()
    expect(ev.trigger).toEqual({
      type: 'onObjectClick',
      button: 'right',
      radius: 32,
    })
    expect(ev.actions).toEqual([
      { type: 'clickToDestroy', button: 'right', radius: 32 },
    ])
    expect(isClickToDestroyEvent(ev)).toBe(true)
    expect(clickToDestroySummary(ev)).toBe('Click to destroy (right mouse)')
  })

  it('applyClickToDestroyTrigger fixes wrong trigger', () => {
    const ev = applyClickToDestroyTrigger({
      id: 'e1',
      enabled: true,
      trigger: { type: 'onMouseInput', button: 'left', eventType: 'pressed' },
      actions: [{ type: 'clickToDestroy', button: 'right', radius: 48 }],
    })
    expect(ev.trigger).toEqual({
      type: 'onObjectClick',
      button: 'right',
      radius: 48,
    })
  })

  it('isClickToDestroyEvent accepts legacy destroy self recipe', () => {
    const ev: LogicEvent = {
      id: 'e1',
      enabled: true,
      trigger: { type: 'onObjectClick', button: 'right', radius: 32 },
      actions: [{ type: 'destroyEntity', target: 'self' }],
    }
    expect(isClickToDestroyEvent(ev)).toBe(true)
  })

  it('isClickToDestroyEvent is false when extra actions are present', () => {
    const ev = createClickToDestroyEvent()
    ev.actions.push({ type: 'debugLog', message: 'bye' })
    expect(isClickToDestroyEvent(ev)).toBe(false)
  })

  it('compiles to object click hit test and destroy self', () => {
    const lua = compileLogicBoard([board([createClickToDestroyEvent()])])
    expect(lua).toContain('input.mouseButtonDown(1)')
    expect(lua).toContain('input.mouseWorld()')
    expect(lua).toContain('entity.destroy(self)')
    expect(lua).not.toContain('input.preventDefault')
  })
})
