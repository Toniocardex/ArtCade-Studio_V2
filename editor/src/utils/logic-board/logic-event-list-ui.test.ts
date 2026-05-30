import { describe, expect, it } from 'vitest'
import {
  focusIdAfterDelete,
  logicEventRowSelector,
  siblingEventId,
} from './logic-event-list-ui'
import type { LogicEvent } from '../../types/logic-board'

const ev = (id: string): LogicEvent => ({
  id,
  enabled: true,
  trigger: { type: 'onStart' },
  actions: [],
})

describe('logic-event-list-ui', () => {
  it('logicEventRowSelector builds data-attribute selector', () => {
    expect(logicEventRowSelector('ev-1')).toBe('[data-logic-event-id="ev-1"]')
  })

  it('siblingEventId moves within list and clamps at ends', () => {
    const list = [ev('a'), ev('b'), ev('c')]
    expect(siblingEventId(list, 'b', 'down')).toBe('c')
    expect(siblingEventId(list, 'b', 'up')).toBe('a')
    expect(siblingEventId(list, 'a', 'up')).toBe('a')
    expect(siblingEventId(list, 'c', 'down')).toBe('c')
    expect(siblingEventId(list, null, 'down')).toBe('a')
  })

  it('focusIdAfterDelete picks neighbor at same index', () => {
    const list = [ev('a'), ev('b'), ev('c')]
    expect(focusIdAfterDelete(list, 'b')).toBe('c')
    expect(focusIdAfterDelete(list, 'c')).toBe('b')
    expect(focusIdAfterDelete(list, 'a')).toBe('b')
    expect(focusIdAfterDelete([ev('only')], 'only')).toBeNull()
  })
})
