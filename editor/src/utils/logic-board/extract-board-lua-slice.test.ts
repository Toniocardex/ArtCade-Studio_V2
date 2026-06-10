import { describe, it, expect } from 'vitest'
import { compileLogicBoard } from './compiler'
import { logicBoardLuaCommentLabel } from './labels'
import { extractBoardLuaSlice } from './extract-board-lua-slice'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'

function board(events: LogicEvent[], overrides?: Partial<LogicBoard>): LogicBoard {
  return {
    boardId: 'board_a',
    name: 'Player movement',
    target: { type: 'object_type', objectTypeId: 'Player' },
    events,
    ...overrides,
  }
}

function ev(partial: Partial<LogicEvent> & Pick<LogicEvent, 'trigger' | 'actions'>): LogicEvent {
  return { id: 'e1', enabled: true, ...partial }
}

describe('extractBoardLuaSlice', () => {
  it('returns empty when label does not appear', () => {
    const full = [
      '  -- board: Other',
      '  do end',
    ].join('\n')
    const { text, sectionCount } = extractBoardLuaSlice(full, 'Missing')
    expect(sectionCount).toBe(0)
    expect(text).toBe('')
  })

  it('extracts two sections for the same board (init and tick)', () => {
    const full = [
      'local function _logic_init()',
      '  -- board: Alpha',
      '  do init_a() end',
      '  -- board: Beta',
      '  do init_b() end',
      'end',
      'function tick(dt)',
      '  -- board: Alpha',
      '  do tick_a() end',
      '  -- board: Beta',
      '  do tick_b() end',
      'end',
    ].join('\n')

    const { text, sectionCount } = extractBoardLuaSlice(full, 'Alpha')
    expect(sectionCount).toBe(2)
    expect(text).toContain('-- board: Alpha')
    expect(text).toContain('init_a()')
    expect(text).toContain('tick_a()')
    expect(text).not.toContain('Beta')
    expect(text).not.toContain('init_b()')
  })

  it('matches compiler output labels including sanitized names', () => {
    const b: LogicBoard = {
      boardId: 'board_multiline',
      name: 'Player\nmovement',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [
        ev({
          trigger: { type: 'onUpdate' },
          actions: [{ type: 'debugLog', message: 'frame' }],
        }),
      ],
    }
    const full = compileLogicBoard([b])
    const label = logicBoardLuaCommentLabel(b)
    expect(label).toBe('Player movement')

    const { text, sectionCount } = extractBoardLuaSlice(full, label)
    expect(sectionCount).toBeGreaterThan(0)
    expect(text).toContain('debug.log')
    expect(text).not.toContain('-- board: Player\nmovement')
  })

  it('isolates one board from a multi-board compile', () => {
    const full = compileLogicBoard([
      board([
        ev({
          id: 'jump',
          trigger: { type: 'onInput', keyCode: 'Space', eventType: 'down' },
          actions: [{ type: 'debugLog', message: 'jump' }],
        }),
      ]),
      {
        boardId: 'board_coin',
        name: 'Coins',
        target: { type: 'object_type', objectTypeId: 'Player' },
        events: [
          ev({
            id: 'coin',
            trigger: { type: 'onUpdate' },
            actions: [{ type: 'debugLog', message: 'coin' }],
          }),
        ],
      },
    ])

    const playerLabel = logicBoardLuaCommentLabel({
      boardId: 'board_a',
      name: 'Player movement',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [],
    })
    const { text } = extractBoardLuaSlice(full, playerLabel)
    expect(text).toContain('jump')
    expect(text).not.toContain('coin')
  })
})
