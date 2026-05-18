import { describe, it, expect } from 'vitest'
import {
  compileLogicBoard,
  luaString,
  luaValue,
  targetExpr,
  conditionExpr,
} from './compiler'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'

// Small helpers to build boards tersely.
function board(events: LogicEvent[], className = 'Player'): LogicBoard {
  return { boardId: 'b1', target: { type: 'entity_class', className }, events }
}
function ev(partial: Partial<LogicEvent> & Pick<LogicEvent, 'trigger' | 'actions'>): LogicEvent {
  return { id: 'e1', enabled: true, ...partial }
}

describe('literal helpers', () => {
  it('escapes Lua strings', () => {
    expect(luaString('a"b\\c\n')).toBe('"a\\"b\\\\c\\n"')
  })
  it('renders Lua values', () => {
    expect(luaValue(42)).toBe('42')
    expect(luaValue(true)).toBe('true')
    expect(luaValue('hi')).toBe('"hi"')
    expect(luaValue(Infinity)).toBe('0')
  })
})

describe('targetExpr', () => {
  it('maps self/other/id/class', () => {
    expect(targetExpr('self')).toBe('self')
    expect(targetExpr('other')).toBe('other')
    expect(targetExpr({ entityId: 7 })).toBe('7')
    expect(targetExpr({ className: 'Coin', first: true })).toBe(
      '(pool.getAll("Coin")[1])',
    )
  })
})

describe('conditionExpr', () => {
  it('flat list is AND of leaves', () => {
    const e = ev({
      trigger: { type: 'onUpdate' },
      conditions: [
        { type: 'isKeyDown', keyCode: 'Space' },
        { type: 'compareVariable', key: 'hp', operator: '>', value: 0 },
      ],
      actions: [],
    })
    expect(conditionExpr(e)).toBe(
      'input.isKeyDown("Space") and (state.get("hp") > 0)',
    )
  })

  it('conditionRoot supports nested OR/AND', () => {
    const e = ev({
      trigger: { type: 'onUpdate' },
      conditionRoot: {
        kind: 'group',
        operator: 'OR',
        statements: [
          { kind: 'leaf', condition: { type: 'compareVariable', key: 'hasKey', operator: '==', value: 1 } },
          {
            kind: 'group',
            operator: 'AND',
            statements: [
              { kind: 'leaf', condition: { type: 'compareVariable', key: 'thief', operator: '==', value: 1 } },
              { kind: 'leaf', condition: { type: 'compareVariable', key: 'pick', operator: '==', value: 1 } },
            ],
          },
        ],
      },
      actions: [],
    })
    expect(conditionExpr(e)).toBe(
      '((state.get("hasKey") == 1) or ((state.get("thief") == 1) and (state.get("pick") == 1)))',
    )
  })
})

describe('compileLogicBoard — structure', () => {
  it('always emits tick(dt) with init guard', () => {
    const lua = compileLogicBoard([board([])])
    expect(lua).toContain('function tick(dt)')
    expect(lua).toContain('if not _init_done then')
    expect(lua).toContain('_logic_init()')
    expect(lua).toContain('local _timers = {}')
  })

  it('onStart goes into init block, not tick body', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          id: 's1',
          trigger: { type: 'onStart' },
          actions: [{ type: 'debugLog', message: 'hello' }],
        }),
      ]),
    ])
    const initIdx = lua.indexOf('_logic_init')
    const tickIdx = lua.indexOf('function tick')
    expect(lua).toContain('debug.log("hello")')
    // the debug.log call must appear before tick(dt) definition (i.e. in init)
    expect(lua.indexOf('debug.log("hello")')).toBeGreaterThan(initIdx)
    expect(lua.indexOf('debug.log("hello")')).toBeLessThan(tickIdx)
  })

  it('skips disabled events', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          enabled: false,
          trigger: { type: 'onUpdate' },
          actions: [{ type: 'debugLog', message: 'NO' }],
        }),
      ]),
    ])
    expect(lua).not.toContain('NO')
  })

  it('iterates the target class pool for self', () => {
    const lua = compileLogicBoard([
      board(
        [ev({ trigger: { type: 'onUpdate' }, actions: [{ type: 'stopAllAudio' }] })],
        'Enemy',
      ),
    ])
    expect(lua).toContain('for _, self in ipairs(pool.getAll("Enemy")) do')
  })
})

describe('compileLogicBoard — triggers', () => {
  it('onInput maps eventType to the right API', () => {
    const mk = (eventType: 'pressed' | 'down' | 'released') =>
      compileLogicBoard([
        board([
          ev({
            trigger: { type: 'onInput', keyCode: 'KeyW', eventType },
            actions: [{ type: 'debugLog', message: 'x' }],
          }),
        ]),
      ])
    expect(mk('down')).toContain('input.isKeyDown("KeyW")')
    expect(mk('pressed')).toContain('input.wasKeyPressed("KeyW")')
    expect(mk('released')).toContain('input.wasKeyReleased("KeyW")')
  })

  it('onCollision withClass gates on collision.touchingClass', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onCollision', withClass: 'Coin' },
          actions: [{ type: 'addVariable', key: 'score', amount: 1 }],
        }),
      ]),
    ])
    expect(lua).toContain('if collision.touchingClass(self, "Coin") then')
    expect(lua).toContain('state.add("score", 1)')
  })

  it('onTimer non-repeat accumulates dt without reset', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTimer', seconds: 2, repeat: false },
          actions: [{ type: 'debugLog', message: 'tick' }],
        }),
      ]),
    ])
    expect(lua).toContain('_timers["b1:e1"] = (_timers["b1:e1"] or 0) + dt')
    expect(lua).toContain('if _timers["b1:e1"] >= 2 then')
    expect(lua).not.toContain('_timers["b1:e1"] = 0')
  })

  it('onTimer repeat resets the accumulator', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTimer', seconds: 1.5, repeat: true },
          actions: [{ type: 'debugLog', message: 'tick' }],
        }),
      ]),
    ])
    expect(lua).toContain('_timers["b1:e1"] = 0')
    expect(lua).toContain('if _timers["b1:e1"] >= 1.5 then')
  })
})

describe('compileLogicBoard — actions', () => {
  it('emits every MVP action correctly', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [
            { type: 'setVariable', key: 'lives', value: 3 },
            { type: 'addVariable', key: 'score', amount: 10 },
            { type: 'setPosition', target: 'self', x: 5, y: 6 },
            { type: 'setVelocity', target: { entityId: 9 }, vx: 1, vy: -2 },
            { type: 'playSound', path: 'sfx/jump.ogg', volume: 0.5, pitch: 1.2 },
            { type: 'playMusic', path: 'bgm.ogg', loop: false },
            { type: 'stopAllAudio' },
            { type: 'destroyEntity', target: { className: 'Bullet', first: true } },
            { type: 'spawnEntity', className: 'Enemy', x: 100, y: 0 },
            { type: 'setGlobalState', key: 'level', value: 2 },
            { type: 'emitEvent', name: 'wave_cleared' },
            { type: 'emitEvent', name: 'dmg', payloadKey: 'amount', payloadValue: 5 },
            { type: 'debugLog', message: 'done' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('state.set("lives", 3)')
    expect(lua).toContain('state.add("score", 10)')
    expect(lua).toContain('entity.setPosition(self, 5, 6)')
    expect(lua).toContain('entity.setVelocity(9, 1, -2)')
    expect(lua).toContain('audio.playSound("sfx/jump.ogg", 0.5, 1.2)')
    expect(lua).toContain('audio.playMusic("bgm.ogg", false)')
    expect(lua).toContain('audio.stopAll()')
    expect(lua).toContain('entity.destroy((pool.getAll("Bullet")[1]))')
    expect(lua).toContain('object.spawn("Enemy", 100, 0)')
    expect(lua).toContain('state.set("level", 2)')
    expect(lua).toContain('event.emit("wave_cleared")')
    expect(lua).toContain('event.emit("dmg", { ["amount"] = 5 })')
    expect(lua).toContain('debug.log("done")')
  })

  it('playSound defaults volume/pitch to 1', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [{ type: 'playSound', path: 'a.ogg' }],
        }),
      ]),
    ])
    expect(lua).toContain('audio.playSound("a.ogg", 1, 1)')
  })
})

describe('compileLogicBoard — realistic example', () => {
  it('jump on Space + coin pickup', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'player_controller',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            id: 'jump',
            trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
            actions: [{ type: 'setVelocity', target: 'self', vx: 0, vy: -400 }],
          }),
          ev({
            id: 'coin',
            trigger: { type: 'onCollision', withClass: 'Coin' },
            actions: [
              { type: 'addVariable', key: 'coins', amount: 1 },
              { type: 'playSound', path: 'sfx/coin.ogg' },
            ],
          }),
        ],
      },
    ])
    expect(lua).toContain('-- board: player_controller')
    expect(lua).toContain('if input.wasKeyPressed("Space") then')
    expect(lua).toContain('entity.setVelocity(self, 0, -400)')
    expect(lua).toContain('if collision.touchingClass(self, "Coin") then')
    expect(lua).toContain('state.add("coins", 1)')
    expect(lua).toContain('audio.playSound("sfx/coin.ogg", 1, 1)')
  })
})
