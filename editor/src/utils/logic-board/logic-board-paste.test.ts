import { describe, expect, it } from 'vitest'
import { createLogicEvent } from './factory'
import { eventCompatibilityError } from './trigger-compatibility'
import type { LogicBoard } from '../../types/logic-board'

describe('Logic Board paste compatibility', () => {
  it('blocks onSpawn paste onto global board', () => {
    const globalBoard: LogicBoard = {
      boardId: 'g',
      name: 'Global',
      target: { type: 'global' },
      events: [],
    }
    const ev = createLogicEvent({ type: 'onSpawn' }, [])
    expect(eventCompatibilityError(ev, globalBoard.target.type)).toMatch(/onSpawn/)
  })
})
