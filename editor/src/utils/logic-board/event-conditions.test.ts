import { describe, expect, it } from 'vitest'
import type { LogicEvent } from '../../types/logic-board'
import { eventHasConditionBlock, eventUsesElseBranch } from './event-conditions'

describe('event-conditions', () => {
  const ev: LogicEvent = {
    id: 'e',
    enabled: true,
    trigger: { type: 'onUpdate' },
    actions: [],
  }

  it('detects condition block', () => {
    expect(eventHasConditionBlock(ev)).toBe(false)
    expect(
      eventHasConditionBlock({
        ...ev,
        onlyIfEnabled: true,
        conditions: [{ type: 'compareVariable', key: 'x', operator: '==', value: 0 }],
      }),
    ).toBe(true)
  })

  it('else requires conditions', () => {
    expect(
      eventUsesElseBranch({
        ...ev,
        elseEnabled: true,
        elseActions: [{ type: 'debugLog', message: 'x' }],
      }),
    ).toBe(false)
    expect(
      eventUsesElseBranch({
        ...ev,
        onlyIfEnabled: true,
        conditions: [{ type: 'compareVariable', key: 'x', operator: '==', value: 0 }],
        elseEnabled: true,
        elseActions: [{ type: 'debugLog', message: 'x' }],
      }),
    ).toBe(true)
  })
})
