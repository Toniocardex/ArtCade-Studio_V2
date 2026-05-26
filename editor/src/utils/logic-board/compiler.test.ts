import { describe, it, expect } from 'vitest'
import {
  compileLogicBoard,
  luaString,
  luaValue,
  targetExpr,
  conditionExpr,
} from './compiler'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'

// Small helpers to build boards tersely.
function board(events: LogicEvent[], className = 'Player'): LogicBoard {
  return { boardId: 'b1', target: { type: 'entity_class', className }, events }
}
function ev(partial: Partial<LogicEvent> & Pick<LogicEvent, 'trigger' | 'actions'>): LogicEvent {
  return { id: 'e1', enabled: true, ...partial }
}

function miniProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1, name: 'Hero', className: 'Player', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
    },
    scenes: {
      s: {
        id: 's', name: 'S', worldSize: { x: 1280, y: 720 }, viewportSize: { x: 1280, y: 720 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1],
      },
    },
  }
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

describe('Component API actions and conditions', () => {
  it('emits movement intent and platformer jump API calls', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onInput', keyCode: 'KeyA', eventType: 'pressed' },
          actions: [
            { type: 'moveController', target: 'self', direction: 'left' },
            { type: 'requestPlatformerJump', target: 'self' },
            { type: 'clearMovementIntent', target: 'self' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('movement.setIntent(self, -1, 0)')
    expect(lua).toContain('platformer.requestJump(self)')
    expect(lua).toContain('movement.clearIntent(self)')
  })

  it('emits frame movement as a held-key controller intent', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onInput', keyCode: 'KeyA', eventType: 'down' },
          actions: [
            { type: 'controllerMovement', target: 'self', direction: 'left' },
          ],
        }),
      ]),
    ])

    expect(lua).toContain('local _logic_movement_known = {}')
    expect(lua).toContain('_logic_movement_frame = {}')
    expect(lua).toContain('if input.isKeyDown("KeyA") and (_logic_on[RULE.hold_a] ~= false) then')
    expect(lua).toContain('_logic_add_movement(self, -1, 0)')
    expect(lua).toContain('_logic_flush_movement()')
    expect(lua).toContain('movement.clearIntent(entityId)')
  })

  it('emits component runtime API calls (Tranche 2)', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          conditions: [
            { type: 'isPlatformerGrounded', target: 'self' },
          ],
          actions: [
            { type: 'setLinearMoverDirection', target: 'self', directionX: 0, directionY: 1 },
            { type: 'setLinearMoverSpeed', target: 'self', speed: 120 },
            { type: 'pauseLinearMover', target: 'self' },
            { type: 'resumeLinearMover', target: 'self' },
            { type: 'setMagnetEnabled', target: 'self', enabled: false },
            { type: 'setMagnetTargetTag', target: 'self', tag: 'coin' },
            { type: 'setHordeTargetClass', target: 'self', className: 'Player' },
            { type: 'setHordeWeights', target: 'self', chaseWeight: 2, separationWeight: 0.5 },
            { type: 'setAutoDestroyLifespan', target: 'self', lifespan: 3 },
            { type: 'cancelAutoDestroy', target: 'self' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('platformer.isGrounded(self)')
    expect(lua).toContain('linearMover.setDirection(self, 0, 1)')
    expect(lua).toContain('linearMover.setSpeed(self, 120)')
    expect(lua).toContain('linearMover.pause(self)')
    expect(lua).toContain('linearMover.resume(self)')
    expect(lua).toContain('magnet.setEnabled(self, false)')
    expect(lua).toContain('magnet.setTargetTag(self, "coin")')
    expect(lua).toContain('horde.setTargetClass(self, "Player")')
    expect(lua).toContain('horde.setWeights(self, 2, 0.5)')
    expect(lua).toContain('autoDestroy.setLifespan(self, 3)')
    expect(lua).toContain('autoDestroy.cancel(self)')
  })

  it('emits health API calls and compareHealth conditions', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          conditions: [
            { type: 'compareHealth', target: 'self', field: 'current', operator: '>', value: 0 },
          ],
          actions: [
            { type: 'damageEntity', target: 'self', amount: 5 },
            { type: 'healEntity', target: 'self', amount: 3 },
            { type: 'setEntityHealth', target: 'self', currentHp: 10, maxHp: 20 },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('local _c,_m=entity.health(self)')
    expect(lua).toContain('return (_c > 0)')
    expect(lua).toContain('entity.damage(self, 5)')
    expect(lua).toContain('entity.setHealth(self, math.min(_m, _c + 3), _m)')
    expect(lua).toContain('entity.setHealth(self, 10, 20)')
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

  it('onlyIfEnabled=false ignores saved flat conditions', () => {
    const e = ev({
      trigger: { type: 'onUpdate' },
      onlyIfEnabled: false,
      conditions: [
        { type: 'compareVariable', key: 'hp', operator: '>', value: 0 },
      ],
      actions: [],
    })

    expect(conditionExpr(e)).toBe('true')
  })

  it('onlyIfEnabled=false ignores saved advanced conditions', () => {
    const e = ev({
      trigger: { type: 'onUpdate' },
      onlyIfEnabled: false,
      conditionRoot: {
        kind: 'leaf',
        condition: { type: 'compareVariable', key: 'hp', operator: '>', value: 0 },
      },
      actions: [],
    })

    expect(conditionExpr(e)).toBe('true')
  })
})

describe('compileLogicBoard — structure', () => {
  it('always emits tick(dt) with init guard', () => {
    const lua = compileLogicBoard([board([])])
    expect(lua).toContain('function tick(dt)')
    expect(lua).toContain('if not _init_done then')
    expect(lua).toContain('_logic_init()')
    expect(lua).toContain('local _logic_timers = {}')
  })

  it('marks event-only boards as not requiring Lua tick when no project tick exists', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
          actions: [{ type: 'debugLog', message: 'jump' }],
        }),
      ]),
    ])
    expect(lua).toContain('__artcade_requires_tick = false or (__artcade_project_tick ~= nil)')
    expect(lua).toContain('if not __artcade_requires_tick and not _init_done then')
  })

  it('marks polling boards as requiring Lua tick', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [{ type: 'debugLog', message: 'frame' }],
        }),
      ]),
    ])
    expect(lua).toContain('__artcade_requires_tick = true or (__artcade_project_tick ~= nil)')
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

  it('iterates a single-id pool for entity_id boards', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'board_guardia',
        target: { type: 'entity_id', entityId: 7 },
        events: [
          ev({ trigger: { type: 'onUpdate' }, actions: [{ type: 'stopAllAudio' }] }),
        ],
      },
    ])
    expect(lua).toContain('for _, self in ipairs({ 7 }) do')
    // The only pool.getAll occurrence allowed is inside _logic_reg_spawn's
    // replay loop in the prelude (helper definition, always emitted).
    // Boards with no onSpawn must add no further pool.getAll calls.
    const poolGetAllCount = lua.split('pool.getAll(').length - 1
    expect(poolGetAllCount).toBe(1)
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
    expect(mk('pressed')).toContain('_logic_reg_input_pressed("KeyW", function()')
    expect(mk('released')).toContain('_logic_reg_input_released("KeyW", function()')
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
    expect(lua).toContain('collision.touchingClass(self, "Coin")')
    expect(lua).toContain('_logic_on[RULE.on_collision_coin] ~= false')
    expect(lua).toContain('state.add("score", 1)')
  })

  it('onTimer non-repeat on entity_id board uses registration path', () => {
    // Single-entity boards keep the cheaper time.after registration —
    // shared vs per-instance is moot when the pool has one entry.
    const lua = compileLogicBoard([
      {
        boardId: 'b1',
        target: { type: 'entity_id', entityId: 7 },
        events: [
          ev({
            trigger: { type: 'onTimer', seconds: 2, repeat: false },
            actions: [{ type: 'debugLog', message: 'tick' }],
          }),
        ],
      },
    ])
    expect(lua).toContain('_logic_reg_timer_after(2, function()')
    expect(lua).toContain('debug.log("tick")')
  })

  it('onTimer repeat on entity_id board uses registration path', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'b1',
        target: { type: 'entity_id', entityId: 7 },
        events: [
          ev({
            trigger: { type: 'onTimer', seconds: 1.5, repeat: true },
            actions: [{ type: 'debugLog', message: 'tick' }],
          }),
        ],
      },
    ])
    expect(lua).toContain('_logic_reg_timer_every(1.5, function()')
    expect(lua).toContain('debug.log("tick")')
  })

  it('onTimer on entity_class board uses per-instance tick timers', () => {
    // Class-targeted board → tick path with per-self key so each entity
    // has its own clock. Avoids the "50 enemies share one 2s timer" bug.
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTimer', seconds: 2, repeat: true },
          actions: [{ type: 'debugLog', message: 'tick' }],
        }),
      ]),
    ])
    expect(lua).toContain('local _tk = "b1:e1:" .. tostring(self)')
    expect(lua).toContain('_logic_timers[_tk] = (_logic_timers[_tk] or 0) + dt')
    expect(lua).toContain('_logic_timers[_tk] = _logic_timers[_tk] - 2')
    // Must NOT take the registration path for class-targeted boards.
    const everyCount = lua.split('_logic_reg_timer_every(').length - 1
    expect(everyCount).toBe(1) // only the prelude helper definition
  })

  it('onTimer in tick-fallback path parks one-shot at -math.huge after fire', () => {
    // controllerMovement forces usesTickFallback=true even for onTimer,
    // routing the timer through the inline tick body branch.
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTimer', seconds: 2, repeat: false },
          actions: [
            { type: 'controllerMovement', target: 'self', direction: 'left' },
          ],
        }),
      ]),
    ])
    // One-shot must guard against the "fires every frame after expiry" bug
    // by parking the accumulator past any reachable threshold. The per-
    // instance key uses local _tk = "<prefix>" .. tostring(self).
    expect(lua).toContain('local _tk = "b1:e1:" .. tostring(self)')
    expect(lua).toContain('_logic_timers[_tk] = -math.huge')
    expect(lua).not.toContain('_logic_timers[_tk] = 0')
  })

  it('onDestroy tick-fallback iterates _destroy_events with self bound', () => {
    // entity_id board without a ProjectDoc -> no derivable className ->
    // onDestroy goes through the fallback tick path (not lifecycle.onDestroy).
    const lua = compileLogicBoard([
      {
        boardId: 'b1',
        target: { type: 'entity_id', entityId: 99 },
        events: [
          ev({
            trigger: { type: 'onDestroy' },
            actions: [{ type: 'debugLog', message: 'bye' }],
          }),
        ],
      },
    ])
    // Fallback must walk _destroy_events with self bound from de.entityId.
    expect(lua).toContain('for _, de in ipairs(_destroy_events) do')
    expect(lua).toContain('local self = de.entityId')
    expect(lua).toContain('debug.log("bye")')
    // The previous broken scaffolding compared de.entityId to a `self` from
    // pool.getAll, which never matched a destroyed entity. Guard against it.
    expect(lua).not.toContain('if de.entityId == self')
    // No registration emit (no class to register against) — the only
    // occurrence of the helper name is its definition in the prelude.
    const regDestroyCount = lua.split('_logic_reg_destroy(').length - 1
    expect(regDestroyCount).toBe(1)
  })

  it('onTimer repeat in tick-fallback subtracts interval to preserve cadence', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTimer', seconds: 1.5, repeat: true },
          actions: [
            { type: 'controllerMovement', target: 'self', direction: 'right' },
          ],
        }),
      ]),
    ])
    // Subtract-instead-of-reset preserves average rate even under frame drift.
    expect(lua).toContain('_logic_timers[_tk] = _logic_timers[_tk] - 1.5')
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
            { type: 'setVariable', key: 'level', value: 2 },
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

  // Regression for the "unknown enum crashes the compiler" path: a stale
  // project.json (older editor, hand-edited save, future runtime) may pass
  // an action whose enum value the current emitter doesn't recognise.
  // actionLua used to fall off the switch and return undefined, which then
  // silently dropped the action from the compiled Lua (the consumer guard
  // `if (code && !code.startsWith('--'))` masked the undefined). We now
  // emit a TODO comment so the issue surfaces in the Lua preview AND the
  // compiler keeps producing a parseable script for the rest of the board.
  it('unknown action enum produces a TODO comment instead of crashing', () => {
    // moveInDirection with an unrecognised direction.
    const board1 = {
      boardId: 'b', target: { type: 'entity_class', className: 'Player' },
      events: [{
        id: 'e', enabled: true,
        trigger: { type: 'onSpawn' },
        // direction is typed as a union; cast through unknown for the test.
        actions: [{ type: 'moveInDirection', target: 'self',
                    direction: 'diagonal-up-left', speed: 100 } as unknown as never],
      }],
    } as never
    const lua = compileLogicBoard([board1 as never])
    // The compiler must not throw and must not embed `undefined` anywhere.
    expect(lua).not.toContain('undefined')
    // Surface the dropped action so the user can fix it.
    expect(lua).toContain('-- TODO ArtCade: unknown action "moveInDirection"')

    // Completely unknown top-level action type.
    const board2 = {
      boardId: 'b2', target: { type: 'entity_class', className: 'Player' },
      events: [{
        id: 'e2', enabled: true,
        trigger: { type: 'onSpawn' },
        actions: [{ type: 'newFutureAction', target: 'self' } as unknown as never],
      }],
    } as never
    const lua2 = compileLogicBoard([board2 as never])
    expect(lua2).not.toContain('undefined')
    expect(lua2).toContain('-- TODO ArtCade: unknown action "newFutureAction"')
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
    expect(lua).toContain('_logic_reg_input_pressed("Space", function()')
    expect(lua).toContain('entity.setVelocity(self, 0, -400)')
    expect(lua).toContain('collision.touchingClass(self, "Coin")')
    expect(lua).toContain('state.add("coins", 1)')
    expect(lua).toContain('audio.playSound("sfx/coin.ogg", 1, 1)')
  })

  it('uses custom board names in generated comments while keeping ids internal', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'board_mplxyz_1',
        name: 'Player movement',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            id: 'jump',
            trigger: { type: 'onInput', keyCode: 'Space', eventType: 'down' },
            actions: [{ type: 'debugLog', message: 'jump' }],
          }),
        ],
      },
    ])

    expect(lua).toContain('-- board: Player movement')
    expect(lua).toContain('_logic_on[RULE.hold_space] ~= false')
    expect(lua).toContain('hold_space = "jump"')
    expect(lua).not.toContain('-- board: board_mplxyz_1')
  })

  it('keeps runtime keys on boardId when the visible compiler label changes', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'board_stable_key',
        name: 'Player movement',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            id: 'mouse',
            trigger: { type: 'onMouseInput', button: 'left', eventType: 'pressed' },
            actions: [{ type: 'debugLog', message: 'click' }],
          }),
        ],
      },
    ])

    expect(lua).toContain('-- board: Player movement')
    // Key prefix uses boardId (stable) and trailing self-suffix concat.
    expect(lua).toContain('"board_stable_key:mouse:"')
    expect(lua).not.toContain('"Player movement:mouse')
  })

  it('sanitizes compiler labels only when emitting Lua comments', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'board_multiline',
        name: 'Player\nmovement',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            trigger: { type: 'onUpdate' },
            actions: [{ type: 'debugLog', message: 'frame' }],
          }),
        ],
      },
    ])

    expect(lua).toContain('-- board: Player movement')
    expect(lua).not.toContain('-- board: Player\nmovement')
  })
})

describe('Logic Components — Phase A (new blocks)', () => {
  it('toggleLogicEvent gates every event via _logic_on', () => {
    const lua = compileLogicBoard([
      board([
        ev({ id: 'A', trigger: { type: 'onUpdate' },
             actions: [{ type: 'toggleLogicEvent', eventId: 'B', enabled: false }] }),
      ]),
    ])
    expect(lua).toContain('local _logic_on = {}')
    // Event A has trigger onUpdate → slug `on_update`; aliased via RULE.
    expect(lua).toContain('on_update = "A"')
    expect(lua).toContain('_logic_on[RULE.on_update] ~= false')
    // Event B is referenced only by toggleLogicEvent and does not exist in
    // the doc, so it falls back to the raw quoted id — still addressable.
    expect(lua).toContain('_logic_on["B"] = false')
  })

  it('emits hasTag / compareDistance / isMouseOver / raycastHit', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' },
             conditions: [
               { type: 'hasTag', tag: 'enemy' },
               { type: 'compareDistance', target: 'self', operator: '<=', value: 80 },
               { type: 'isMouseOver', radius: 16 },
               { type: 'raycastHit', dirX: 1, dirY: 0, length: 50, className: 'Wall' },
             ],
             actions: [{ type: 'debugLog', message: 'ok' }] }),
      ]),
    ])
    expect(lua).toContain('object.findByTag("enemy")')
    expect(lua).toContain('object.distance(self, self) <= 80')
    expect(lua).toContain('<= 256')               // isMouseOver r^2 (16^2)
    expect(lua).toContain('collision.raycast(')
    expect(lua).toContain('pool.getAll("Wall")')
  })

  it('onMouseInput compiles a mouse edge-gated event', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onMouseInput', button: 'left', eventType: 'pressed' },
             actions: [{ type: 'debugLog', message: 'click' }] }),
      ]),
    ])
    expect(lua).toContain('input.mouseButtonDown(0)')
    expect(lua).toContain('_mb[')
    expect(lua).toContain('debug.log("click")')
  })

  it('onMessage registers an event.on listener in init', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onMessage', messageName: 'player_hit' },
             actions: [{ type: 'debugLog', message: 'hit' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_message("player_hit", function()')
    expect(lua).toContain('debug.log("hit")')
  })
})

describe('Logic Components — Phase B (new runtime-backed actions)', () => {
  it('emits physics/transform/scene/camera actions', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' }, actions: [
          { type: 'applyImpulse', target: 'self', ix: 0, iy: -300 },
          { type: 'applyForce', target: 'self', fx: 10, fy: 0 },
          { type: 'setRotation', target: 'self', angle: 1.57 },
          { type: 'setScale', target: 'self', scaleX: 2, scaleY: 2 },
          { type: 'setVisible', target: 'self', visible: false },
          { type: 'setColorTint', target: 'self', hexColor: '#ff0000', alpha: 0.5 },
          { type: 'loadScene', sceneName: 'level_2' },
          { type: 'restartScene' },
          { type: 'setCameraTarget', target: 'self' },
        ] }),
      ]),
    ])
    expect(lua).toContain('physics.applyImpulse(self, 0, -300)')
    expect(lua).toContain('physics.applyForce(self, 10, 0)')
    expect(lua).toContain('entity.setRotation(self, 1.57)')
    expect(lua).toContain('entity.setScale(self, 2, 2)')
    expect(lua).toContain('entity.setVisible(self, false)')
    expect(lua).toContain('entity.setTint(self, 1.0000, 0.0000, 0.0000, 0.5)')
    expect(lua).toContain('scene.load("level_2")')
    expect(lua).toContain('scene.restart()')
    expect(lua).toContain('camera.centerOn(self)')
  })
})

describe('Hot-reload safety — handler unsubscribe tracking', () => {
  it('emits __artcade_lb_unsubs reset block above _logic_init', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onSpawn' },
             actions: [{ type: 'debugLog', message: 'spawned' }] }),
      ]),
    ])
    // Reset block runs every script load and revokes prior subscriptions.
    expect(lua).toContain('__artcade_lb_unsubs = __artcade_lb_unsubs or {}')
    expect(lua).toContain('pcall(__artcade_lb_unsubs[i])')
    // Trackers and helpers exist.
    expect(lua).toContain('local function _logic_track(unsub)')
    expect(lua).toContain('local function _logic_bag_unsub(bag, key, fn)')
    // Reset must occur before _logic_init definition.
    const resetIdx = lua.indexOf('__artcade_lb_unsubs = {}')
    const initIdx = lua.indexOf('local function _logic_init()')
    expect(resetIdx).toBeGreaterThan(-1)
    expect(initIdx).toBeGreaterThan(resetIdx)
  })

  it('wraps every event-style registration with _logic_track-aware helpers', () => {
    const lua = compileLogicBoard([
      board([
        ev({ id: 'a', trigger: { type: 'onSpawn' },
             actions: [{ type: 'debugLog', message: 's' }] }),
        ev({ id: 'b', trigger: { type: 'onDestroy' },
             actions: [{ type: 'debugLog', message: 'd' }] }),
        ev({ id: 'c', trigger: { type: 'onTriggerEnter', withClass: 'Coin' },
             actions: [{ type: 'debugLog', message: 't' }] }),
        ev({ id: 'd', trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
             actions: [{ type: 'debugLog', message: 'i' }] }),
        ev({ id: 'f', trigger: { type: 'onMessage', messageName: 'hit' },
             actions: [{ type: 'debugLog', message: 'm' }] }),
      ]),
      // onTimer on a single-entity board → registration path (time.every).
      {
        boardId: 'b2',
        target: { type: 'entity_id', entityId: 7 },
        events: [
          ev({ id: 'e', trigger: { type: 'onTimer', seconds: 1, repeat: true },
               actions: [{ type: 'debugLog', message: 'r' }] }),
        ],
      },
    ])
    // Each public API call should appear exactly once — inside its helper
    // in the prelude. Emit sites must go through the helpers.
    const occur = (needle: string) => lua.split(needle).length - 1
    expect(occur('lifecycle.onSpawn(')).toBe(1)
    expect(occur('lifecycle.onDestroy(')).toBe(1)
    expect(occur('sensor.onEnter(')).toBe(1)
    expect(occur('input.onPressed(')).toBe(1)
    expect(occur('time.every(')).toBe(1)
    expect(occur('event.on(')).toBe(1)
    // Helpers are referenced from the emit sites.
    expect(lua).toContain('_logic_reg_spawn("Player"')
    expect(lua).toContain('_logic_reg_destroy("Player"')
    expect(lua).toContain('_logic_reg_sensor_enter("Player", "Coin"')
    expect(lua).toContain('_logic_reg_input_pressed("Space"')
    expect(lua).toContain('_logic_reg_timer_every(1, function()')
    expect(lua).toContain('_logic_reg_message("hit", function()')
  })
})

describe('Global-target boards (no entity context)', () => {
  it('onStart on global board uses a single nil-self block, no for-loop', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'sysboot',
        target: { type: 'global' },
        events: [
          ev({ trigger: { type: 'onStart' }, actions: [{ type: 'debugLog', message: 'boot' }] }),
        ],
      },
    ])
    expect(lua).toContain('local self = nil')
    expect(lua).toContain('debug.log("boot")')
    // Must not iterate a pool — global boards have no entities to scan.
    expect(lua).not.toContain('for _, self in ipairs(pool.getAll')
    expect(lua).not.toContain('for _, self in ipairs({})')
  })

  it('onInput on global board fires once per keypress, not per pool entry', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'input',
        target: { type: 'global' },
        events: [
          ev({
            trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
            actions: [{ type: 'debugLog', message: 'jump' }],
          }),
        ],
      },
    ])
    expect(lua).toContain('_logic_reg_input_pressed("Space", function()')
    // Inside the closure: nil-self block, no pool iteration.
    const inputClosure = lua.slice(lua.indexOf('_logic_reg_input_pressed('))
    expect(inputClosure).not.toContain('for _, self in ipairs')
    expect(inputClosure).toContain('local self = nil')
  })

  it('onMessage on global board does not wrap in a pool loop', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'msgs',
        target: { type: 'global' },
        events: [
          ev({
            trigger: { type: 'onMessage', messageName: 'level_complete' },
            actions: [{ type: 'debugLog', message: 'done' }],
          }),
        ],
      },
    ])
    expect(lua).toContain('_logic_reg_message("level_complete", function()')
    const closure = lua.slice(lua.indexOf('_logic_reg_message('))
    expect(closure).not.toContain('for _, self in ipairs')
  })
})

describe('Bug #9 — onCollisionEnter / onCollisionExit edge triggers', () => {
  it('emits _logic_collision_edge gate with want_enter=true for onCollisionEnter', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onCollisionEnter', withClass: 'Coin' },
             actions: [{ type: 'addVariable', key: 'score', amount: 1 }] }),
      ]),
    ])
    expect(lua).toContain('_logic_collision_edge(self, "Coin", true)')
    expect(lua).toContain('state.add("score", 1)')
    // The level-triggered collision.touchingClass gate must NOT be used here.
    // (collision.touchingClass appears only inside the edge helper definition.)
    const touchingCount = lua.split('collision.touchingClass(').length - 1
    expect(touchingCount).toBe(1)
  })

  it('emits _logic_collision_edge gate with want_enter=false for onCollisionExit', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onCollisionExit', withClass: 'Spike' },
             actions: [{ type: 'debugLog', message: 'safe' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_collision_edge(self, "Spike", false)')
  })

  it('prelude defines the edge helper and the was-touching memory', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' },
             actions: [{ type: 'debugLog', message: 'x' }] }),
      ]),
    ])
    expect(lua).toContain('local _collision_was_touching = {}')
    expect(lua).toContain('local function _logic_collision_edge(eid, cls, want_enter)')
  })
})

describe('Bug #2 — onSpawn replay for already-alive entities', () => {
  it('_logic_reg_spawn replays for entities in pool.getAll at registration time', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onSpawn' },
             actions: [{ type: 'debugLog', message: 'hi' }] }),
      ]),
    ])
    // Helper definition includes the replay loop.
    expect(lua).toContain('local function _logic_reg_spawn(cls, fn)')
    expect(lua).toContain('for _, eid in ipairs(pool.getAll(cls)) do')
    expect(lua).toContain('pcall(fn, eid, {})')
    // Errors inside replayed callbacks must not abort _logic_init.
    expect(lua).toContain('[logic] onSpawn replay error: ')
  })
})

describe('N3 — onSpawn safe drop without resolvable class', () => {
  it('emits no action code for onSpawn on entity_id board without project context', () => {
    // Theoretical scenario: someone calls compileLogicBoard with no project.
    // entity_id can't resolve a className without project lookup.
    // Pre-N3: usesTickFallback returned true, falling into the generic
    // gate path and firing actions every frame. Post-N3: the event is
    // silently dropped (no registration, no tick body).
    const lua = compileLogicBoard([
      {
        boardId: 'b1',
        target: { type: 'entity_id', entityId: 99 },
        events: [
          ev({
            trigger: { type: 'onSpawn' },
            actions: [{ type: 'debugLog', message: 'SHOULD_NOT_APPEAR' }],
          }),
        ],
      },
    ])
    expect(lua).not.toContain('SHOULD_NOT_APPEAR')
    // Specifically the every-frame symptom: no per-pool for-loop over { 99 }
    // wrapping the action.
    expect(lua).not.toContain('debug.log("SHOULD_NOT_APPEAR")')
  })
})

describe('Logic Components — Phase C (engine-hook triggers)', () => {
  it('onSpawn registers a lifecycle handler', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onSpawn' },
             actions: [{ type: 'debugLog', message: 'spawned' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_spawn("Player", function(entityId, tags)')
    expect(lua).toContain('debug.log("spawned")')
  })

  it('onDestroy on entity_id board registers lifecycle.onDestroy via project class', () => {
    const project = miniProject()
    const lua = compileLogicBoard([
      {
        boardId: 'hero',
        target: { type: 'entity_id', entityId: 1 },
        events: [
          ev({
            trigger: { type: 'onDestroy' },
            actions: [{ type: 'debugLog', message: 'gone' }],
          }),
        ],
      },
    ], project)
    expect(lua).toContain('_logic_reg_destroy("Player", function(entityId, tags)')
    expect(lua).not.toContain('lifecycle.pollDestroyed()')
    expect(lua).toContain('debug.log("gone")')
  })

  it('onTriggerEnter registers a sensor enter handler', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onTriggerEnter', withClass: 'Zone' },
             actions: [{ type: 'debugLog', message: 'in' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_sensor_enter("Player", "Zone", function(entityId, otherId, tag)')
    expect(lua).toContain('local self = entityId')
    expect(lua).toContain('local other = otherId')
    expect(lua).not.toContain('_trig')
    expect(lua).toContain('debug.log("in")')
  })

  it('onTriggerExit registers a sensor exit handler', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onTriggerExit', withClass: 'Zone' },
             actions: [{ type: 'debugLog', message: 'out' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_sensor_exit("Player", "Zone", function(entityId, otherId, tag)')
    expect(lua).toContain('debug.log("out")')
  })

  it('moveInDirection forward uses entity.scale sign', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [
            { type: 'moveInDirection', target: 'self', direction: 'forward', speed: 120 },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('entity.scale(self)')
    expect(lua).toContain('entity.setVelocity')
  })

  it('spawnEntity inheritFlip copies scale sign', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'spawnEntity', className: 'Bullet', x: 0, y: 0, inheritFlip: true },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('entity.scale(self)')
    expect(lua).toContain('entity.setScale(_nid')
  })

  it('wait.then runs before post-wait tail actions (concat semantics)', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'debugLog', message: 'before' },
            { type: 'wait', seconds: 1, then: [
              { type: 'debugLog', message: 'nested' },
            ] },
            { type: 'debugLog', message: 'after' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('debug.log("before")')
    expect(lua).toContain('time.after(1, function()')
    // Both nested and post-wait tail must reach the output; the order must
    // be nested-first, tail-second.
    const nestedIdx = lua.indexOf('debug.log("nested")')
    const afterIdx = lua.indexOf('debug.log("after")')
    expect(nestedIdx).toBeGreaterThan(-1)
    expect(afterIdx).toBeGreaterThan(nestedIdx)
  })

  it('wait splits actions with time.after', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'debugLog', message: 'before' },
            { type: 'wait', seconds: 1.5 },
            { type: 'debugLog', message: 'after' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('debug.log("before")')
    expect(lua).toContain('time.after(1.5, function()')
    expect(lua).toContain('debug.log("after")')
  })

  it('onAnimationEnd registers animation.onFinished while onDestroy uses lifecycle', () => {
    const lua = compileLogicBoard([
      board([
        ev({ id: 'ae', trigger: { type: 'onAnimationEnd', clipName: 'die' },
             actions: [{ type: 'debugLog', message: 'done' }] }),
        ev({ id: 'od', trigger: { type: 'onDestroy' },
             actions: [{ type: 'debugLog', message: 'bye' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_anim_end("Player", "die", function(entityId, clip)')
    expect(lua).not.toContain('animation.pollFinished()')
    expect(lua).toContain('_logic_reg_destroy("Player", function(entityId, tags)')
    expect(lua).toContain('debug.log("done")')
    expect(lua).toContain('debug.log("bye")')
  })
})

describe('RULE alias integrity', () => {
  // Property: every `RULE.<slug>` referenced in the compiled output must have
  // a matching binding inside the `local RULE = { ... }` table. Catches drift
  // between ruleKeyExpr (event-slugs.ts) and buildHeader (compiler-prelude.ts)
  // if a future patch updates one without the other.
  function ruleBindingsAreConsistent(lua: string): {
    referenced: Set<string>
    bound: Set<string>
    missing: string[]
  } {
    const referenced = new Set<string>()
    for (const m of lua.matchAll(/RULE\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      referenced.add(m[1])
    }
    const tableMatch = lua.match(/local RULE = \{([\s\S]*?)\n\}/)
    const bound = new Set<string>()
    if (tableMatch) {
      for (const m of tableMatch[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) {
        bound.add(m[1])
      }
    }
    const missing = [...referenced].filter((s) => !bound.has(s))
    return { referenced, bound, missing }
  }

  it('every RULE.<slug> reference is bound in the RULE table', () => {
    const lua = compileLogicBoard([
      board([
        ev({ id: 'r1', trigger: { type: 'onUpdate' },
             actions: [{ type: 'debugLog', message: 'a' }] }),
        ev({ id: 'r2', trigger: { type: 'onInput', keyCode: 'KeyD', eventType: 'down' },
             actions: [{ type: 'toggleLogicEvent', eventId: 'r1', enabled: false }] }),
        ev({ id: 'r3', trigger: { type: 'onCollision', withClass: 'Coin' },
             actions: [{ type: 'debugLog', message: 'c' }] }),
      ]),
    ])
    const { referenced, missing } = ruleBindingsAreConsistent(lua)
    expect(referenced.size).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })

  it('RULE table is always emitted, even when no events exist', () => {
    const lua = compileLogicBoard([])
    expect(lua).toContain('local RULE = {}')
  })

  it('toggleLogicEvent against an unknown id falls back to the raw quoted id', () => {
    const lua = compileLogicBoard([
      board([
        ev({ id: 'self', trigger: { type: 'onUpdate' },
             actions: [{ type: 'toggleLogicEvent', eventId: 'ghost', enabled: true }] }),
      ]),
    ])
    // ghost has no slug, so the assignment uses the raw quoted id; the read
    // side (this event's own guard) still uses RULE.<slug> for `self`.
    expect(lua).toContain('_logic_on["ghost"] = true')
    const { missing } = ruleBindingsAreConsistent(lua)
    expect(missing).toEqual([])
  })
})

describe('Defensive value coercion', () => {
  it('cameraShake without trauma emits a finite numeric literal', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' },
             actions: [{ type: 'cameraShake' } as never] }),
      ]),
    ])
    expect(lua).toContain('camera.shake(0)')
    expect(lua).not.toContain('camera.shake(undefined)')
    expect(lua).not.toContain('NaN')
  })

  it('setColorTint with non-numeric alpha falls back to 1', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' },
             actions: [{ type: 'setColorTint', target: 'self', hexColor: '#ff0000',
                         alpha: 'oops' as never }] }),
      ]),
    ])
    expect(lua).not.toContain('NaN')
    expect(lua).toContain('entity.setTint(self, ')
  })

  it('loadScene with NaN fadeSeconds omits the fade argument', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' },
             actions: [{ type: 'loadScene', sceneName: 'menu',
                         fadeSeconds: 'oops' as unknown as number }] }),
      ]),
    ])
    expect(lua).toContain('scene.load("menu")')
    expect(lua).not.toContain('NaN')
  })

  it('compareVariable rejects an injected operator', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' },
             conditions: [{ type: 'compareVariable', key: 'k',
                            operator: ') or os.exit(1) --' as never, value: 1 }],
             actions: [{ type: 'debugLog', message: 'x' }] }),
      ]),
    ])
    // The injected operator must collapse to `==`, leaving no shell payload.
    expect(lua).toContain('(state.get("k") == 1)')
    expect(lua).not.toContain('os.exit')
  })
})
