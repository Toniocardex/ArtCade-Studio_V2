import { describe, expect, it } from 'vitest'
import {
  actionDisplayName,
  actionSummaryPlain,
  boardDisplayName,
  triggerDisplayName,
  triggerSummaryPlain,
} from './friendly-labels'
import type { LogicBoard } from '../../types/logic-board'

describe('friendly-labels', () => {
  it('uses plain trigger names', () => {
    expect(triggerDisplayName('onInput')).toBe('Key pressed')
    expect(actionDisplayName('spawnEntity')).toBe('Create object')
  })

  it('summarizes Space key press in plain English', () => {
    const s = triggerSummaryPlain({
      type: 'onInput',
      keyCode: 'Space',
      eventType: 'pressed',
    })
    expect(s).toContain('presses')
    expect(s).toContain('Space')
    expect(s).not.toContain('onInput')
  })

  it('summarizes spawn coin without camelCase', () => {
    const s = actionSummaryPlain({
      type: 'spawnEntity',
      className: 'coin',
      x: 25,
      y: 25,
    })
    expect(s).toContain('Create')
    expect(s).toContain('coin')
    expect(s).not.toContain('spawnEntity')
  })

  it('prompts when spawn class is not chosen', () => {
    const s = actionSummaryPlain({
      type: 'spawnEntity',
      className: '',
      x: 0,
      y: 0,
    })
    expect(s).toContain('choose what to create')
    expect(s).not.toContain('?')
  })

  it('board display uses class name', () => {
    const board: LogicBoard = {
      boardId: 'board_mpe2dp1j_1',
      target: { type: 'entity_class', className: 'Player' },
      events: [],
    }
    expect(boardDisplayName(board)).toBe('Player')
  })
})
