import { describe, expect, it } from 'vitest'
import { logicEventCardSelector } from './logic-event-list-ui'

describe('logic-event-list-ui', () => {
  it('logicEventCardSelector builds data-attribute selector', () => {
    expect(logicEventCardSelector('ev-1')).toBe('[data-logic-event-id="ev-1"]')
  })
})
