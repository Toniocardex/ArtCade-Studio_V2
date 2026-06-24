import { describe, it, expect } from 'vitest'
import {
  compileLogicBoard,
  luaString,
  luaValue,
  targetExpr,
  conditionExpr,
} from './compiler'
import { ruleBindingsAreConsistent } from './rule-bindings-audit'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { createEntityDef } from '../project-builders'
import { createBlankProject } from '../project-factory'

// Small helpers to build boards tersely.
function board(events: LogicEvent[], className = 'Player'): LogicBoard {
  return { boardId: 'b1', target: { type: 'object_type', objectTypeId: className }, events }
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
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
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
    expect(luaString('a"b\\c\n')).toBe(String.raw`"a\"b\\c\n"`)
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
    expect(lua).toMatch(
      /if _logic_on\[RULE\.hold_a\] ~= false then[\s\S]*if input\.isKeyDown\("KeyA"\) then/,
    )
    expect(lua).toContain('_logic_add_movement(self, -1, 0)')
    expect(lua).toContain('_logic_flush_movement()')
    expect(lua).toContain('movement.clearIntent(entityId)')
  })

  it('resolves legacy Entity_* rulesheet pool to scene entity ids', () => {
    const project = createBlankProject('Untitled')
    project.entities[1] = createEntityDef(1, 'Entity_1', 'Entity', { x: 100, y: 100 })
    project.scenes.scene_main.entityIds = [1]
    const lua = compileLogicBoard(
      [
        {
          boardId: 'board_legacy',
          target: { type: 'object_type', objectTypeId: 'Entity_1' },
          events: [
            ev({
              trigger: { type: 'onInput', keyCode: 'KeyA', eventType: 'down' },
              actions: [{ type: 'controllerMovement', target: 'self', direction: 'left' }],
            }),
          ],
        },
      ],
      project,
    )
    expect(lua).toContain('for _, self in ipairs({ 1 }) do')
    expect(lua).not.toContain('pool.getAll("Entity_1")')
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
            { type: 'setMagnetRadius', target: 'self', radius: { source: 'global', key: 'radius' } },
            { type: 'setMagnetPullSpeed', target: 'self', speed: 350 },
            { type: 'setHordeTargetClass', target: 'self', className: 'Player' },
            { type: 'setHordeWeights', target: 'self', chaseWeight: 2, separationWeight: 0.5 },
            { type: 'setHordeMaxSpeed', target: 'self', speed: 180 },
            { type: 'setHordeSeparationRadius', target: 'self', radius: 64 },
            { type: 'setAutoDestroyLifespan', target: 'self', lifespan: 3 },
            { type: 'cancelAutoDestroy', target: 'self' },
            { type: 'endDialog' },
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
    expect(lua).toContain('magnet.setRadius(self, (function() local _number=tonumber(')
    expect(lua).toContain('magnet.setPullSpeed(self, 350)')
    expect(lua).toContain('horde.setTargetClass(self, "Player")')
    expect(lua).toContain('horde.setWeights(self, 2, 0.5)')
    expect(lua).toContain('horde.setMaxSpeed(self, 180)')
    expect(lua).toContain('horde.setSeparationRadius(self, 64)')
    expect(lua).toContain('autoDestroy.setLifespan(self, 3)')
    expect(lua).toContain('autoDestroy.cancel(self)')
    expect(lua).toContain('dialog.finish()')
  })

  it('emits lookAtTarget with the Lua 5.4 two-arg math.atan (not removed math.atan2)', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [
            { type: 'lookAtTarget', target: 'self', toward: { className: 'Player', first: true } },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('math.atan(')
    expect(lua).not.toContain('math.atan2')
  })

  it('emits audio volume and fade API calls plus isMusicPlaying', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          conditions: [{ type: 'isMusicPlaying' }],
          actions: [
            { type: 'setVolume', channel: 'music', volume: 0.5 },
            { type: 'setVolume', channel: 'master', volume: 0.8 },
            { type: 'setVolume', channel: 'sfx', volume: 0.7 },
            { type: 'fadeMusic', volume: 0, seconds: 2 },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('audio.isMusicPlaying()')
    expect(lua).toContain('audio.setMusicVolume(0.5)')
    expect(lua).toContain('audio.setMasterVolume(0.8)')
    expect(lua).toContain('audio.setSfxVolume(0.7)')
    expect(lua).toContain('audio.fadeMusic(0, 2)')
  })

  it('emits modifyVariable clamp as math.max/math.min for both scopes', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [
            { type: 'modifyVariable', scope: 'global', op: 'clamp', key: 'score', min: 0, max: 99 },
            { type: 'modifyVariable', scope: 'object', op: 'clamp', key: 'hp', target: 'self', min: 0, max: 100 },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('global.set("score", math.max(0, math.min(99, (global.get("score") or 0))))')
    expect(lua).toContain('objectvar.set(self, "hp", math.max(0, math.min(100, (objectvar.get(self, "hp") or 0))))')
  })

  it('emits Set Text with value binding, prefix/suffix and integer formatting', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [
            {
              type: 'setText', target: 'self',
              value: { source: 'global', key: 'score' },
              prefix: 'Score: ',
            },
            { type: 'setTextColor', target: 'self', hexColor: '#ff0000' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('local function _logic_tostr(v)')
    expect(lua).toContain('text.set(self, "Score: " .. _logic_tostr(')
    expect(lua).toContain('text.setColor(self, 1.0000, 0.0000, 0.0000, 1)')
  })

  it('emits Set Text with a number format via _logic_fmt', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [
            {
              type: 'setText', target: 'self',
              value: { source: 'global', key: 'time' },
              format: 'time', digits: 0,
            },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('local function _logic_fmt(v, fmt, digits)')
    expect(lua).toContain('text.set(self, _logic_fmt(')
    expect(lua).toContain(', "time", 0)')
  })

  it('emits spawn with launch velocity, pause, and off-screen checks', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
          actions: [
            { type: 'spawnEntity', className: 'Bullet', x: 0, y: 0, velocityX: 0, velocityY: -400 },
            { type: 'setPause', mode: 'pause' },
            { type: 'setScale', target: 'self', scaleX: { source: 'global', key: 'hp' }, scaleY: 1 },
          ],
        }),
        ev({
          trigger: { type: 'onLeaveScreen' },
          actions: [{ type: 'destroyEntity', target: 'self' }],
        }),
      ]),
    ])
    expect(lua).toContain('entity.setVelocity(_nid, 0, -400)')
    expect(lua).toContain('time.pause()')
    expect(lua).toContain('entity.setScale(self,')
    expect(lua).toContain('screen.isOffScreen(self)')
    expect(lua).toContain('local _ls_prev = {}')
  })

  it('emits onDamaged edge detection from previous-frame HP', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onDamaged' },
          actions: [{ type: 'playSound', path: 'assets/audio/hit.ogg' }],
        }),
      ]),
    ])
    expect(lua).toContain('local _dmg_prev = {}')
    expect(lua).toContain('local _prev = _dmg_prev[')
    expect(lua).toContain('if _prev ~= nil and _hc < _prev then')
    expect(lua).toContain('audio.playSound("assets/audio/hit.ogg"')
  })

  it('emits platformer and top-down controller setter API calls', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [
            { type: 'setPlatformerMaxSpeed', target: 'self', speed: 320 },
            { type: 'setPlatformerJumpForce', target: 'self', force: 700 },
            { type: 'setPlatformerGravity', target: 'self', gravity: 1100 },
            { type: 'setTopDownMaxSpeed', target: 'self', speed: 260 },
            { type: 'setTopDownAcceleration', target: 'self', acceleration: 1500 },
            { type: 'setTopDownFriction', target: 'self', friction: 900 },
            { type: 'setTopDownFourDirections', target: 'self', enabled: true },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('platformer.setMaxSpeed(self, 320)')
    expect(lua).toContain('platformer.setJumpForce(self, 700)')
    expect(lua).toContain('platformer.setGravity(self, 1100)')
    expect(lua).toContain('topDown.setMaxSpeed(self, 260)')
    expect(lua).toContain('topDown.setAcceleration(self, 1500)')
    expect(lua).toContain('topDown.setFriction(self, 900)')
    expect(lua).toContain('topDown.setFourDirections(self, true)')
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

  it('resolves legacy Entity_* slug to runtime class for actions', () => {
    const project = createBlankProject('T')
    project.entities[1] = createEntityDef(1, 'Entity_1', 'Entity', { x: 0, y: 0 })
    project.scenes.scene_main.entityIds = [1]
    expect(targetExpr({ className: 'Entity_1', first: true }, project)).toBe('1')
  })
})

describe('conditionExpr', () => {
  it('translates UI not-equal into the Lua operator', () => {
    const e = ev({
      trigger: { type: 'onUpdate' },
      conditions: [
        { type: 'compareValues', left: 1, operator: '!=', right: 2 },
      ],
      actions: [],
    })

    expect(conditionExpr(e)).toBe('(1 ~= 2)')
  })

  it('compares arbitrary Value Sources and dialog state', () => {
    const e = ev({
      trigger: { type: 'onUpdate' },
      conditions: [
        {
          type: 'compareValues',
          left: { source: 'component', target: 'self', property: 'autoDestroy.remaining' },
          operator: '<=',
          right: 1,
        },
        { type: 'isDialogActive' },
      ],
      actions: [],
    })

    expect(conditionExpr(e)).toContain('component.value(_target, "autoDestroy.remaining")')
    expect(conditionExpr(e)).toContain('tonumber(_left)')
    expect(conditionExpr(e)).toContain('dialog.isActive()')
  })

  it('flat list is AND of leaves', () => {
    const e = ev({
      trigger: { type: 'onUpdate' },
      conditions: [
        { type: 'isKeyDown', keyCode: 'Space' },
        { type: 'compareVariable', key: 'hp', operator: '>', value: 0 },
      ],
      actions: [],
    })
    const lua = conditionExpr(e)
    expect(lua).toContain('input.isKeyDown("Space")')
    expect(lua).toContain('global.get("hp")')
    expect(lua).toContain('_leftNumber > _rightNumber')
  })

  it('compareVariable defaults to global, object scope reads objectvar', () => {
    const globalLua = conditionExpr(ev({
      trigger: { type: 'onUpdate' },
      conditions: [{ type: 'compareVariable', key: 'state', operator: '==', value: 'walk' }],
      actions: [],
    }))
    expect(globalLua).toContain('global.get("state")')
    expect(globalLua).not.toContain('objectvar.get')

    const objectLua = conditionExpr(ev({
      trigger: { type: 'onUpdate' },
      conditions: [{ type: 'compareVariable', scope: 'object', key: 'state', operator: '==', value: 'walk' }],
      actions: [],
    }))
    expect(objectLua).toContain('objectvar.get(self, "state")')
    expect(objectLua).not.toContain('global.get("state")')
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
      '((global.get("hasKey") == 1) or ((global.get("thief") == 1) and (global.get("pick") == 1)))',
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
  it('always emits a module tick with init guard', () => {
    const lua = compileLogicBoard([board([])])
    expect(lua).toContain('function module.tick(dt)')
    expect(lua).toContain('if not _init_done then')
    expect(lua).toContain('module.initialize()')
    expect(lua).not.toContain('local _logic_timers = {}')
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
    expect(lua).toContain('module.requiresTick = false')
  })

  it('keeps event-only generated Lua free of unrelated prelude helpers', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          id: 'press_space',
          trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
          actions: [{ type: 'requestPlatformerJump', target: 'self' }],
        }),
      ]),
    ])

    expect(lua).toContain('_logic_reg_input_pressed("Space", function()')
    expect(lua).toContain('platformer.requestJump(self)')
    expect(lua).not.toContain('_logic_random_')
    expect(lua).not.toContain('_logic_tostr')
    expect(lua).not.toContain('_logic_collision_edge')
    expect(lua).not.toContain('_logic_movement_known')
    expect(lua).not.toContain('_logic_flush_movement')
    expect(lua).not.toContain('local _logic_timers = {}')
    expect(lua).not.toContain('local _mb = {}')
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
    expect(lua).toContain('module.requiresTick = true')
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
    const initIdx = lua.indexOf('function module.initialize')
    const tickIdx = lua.indexOf('function module.tick')
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

  it('iterates the type pool for object_type boards', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'board_guardia',
        target: { type: 'object_type', objectTypeId: 'Guardia' },
        events: [
          ev({ trigger: { type: 'onUpdate' }, actions: [{ type: 'stopAllAudio' }] }),
        ],
      },
    ])
    expect(lua).toContain('for _, self in ipairs(pool.getAll("Guardia")) do')
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

  it('onInput alternate keys register OR handlers per key', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: {
            type: 'onInput',
            keyCode: 'KeyW',
            alternateKeyCodes: ['Space'],
            eventType: 'pressed',
          },
          actions: [{ type: 'debugLog', message: 'jump' }],
        }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_input_pressed("KeyW", function()')
    expect(lua).toContain('_logic_reg_input_pressed("Space", function()')
    const downLua = compileLogicBoard([
      board([
        ev({
          trigger: {
            type: 'onInput',
            keyCode: 'KeyW',
            alternateKeyCodes: ['Space'],
            eventType: 'down',
          },
          actions: [{ type: 'debugLog', message: 'hold' }],
        }),
      ]),
    ])
    expect(downLua).toMatch(
      /input\.isKeyDown\("KeyW"\).*or.*input\.isKeyDown\("Space"\)/s,
    )
  })

  it('onInput NOT combo polls with inverted gate', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: {
            type: 'onInput',
            keyCode: 'ShiftLeft',
            alternateKeyCodes: ['ShiftRight'],
            keyCombine: 'NOT',
            eventType: 'down',
          },
          actions: [{ type: 'debugLog', message: 'no shift' }],
        }),
      ]),
    ])
    expect(lua).toMatch(/not \(.*isKeyDown\("ShiftLeft"\).*or.*isKeyDown\("ShiftRight"\)/s)
    expect(lua).not.toMatch(/_logic_reg_input_pressed\("ShiftLeft"/)
  })

  it('onInput AND combo registers primary only and gates modifiers', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: {
            type: 'onInput',
            keyCode: 'KeyW',
            alternateKeyCodes: ['ControlLeft'],
            keyCombine: 'AND',
            eventType: 'pressed',
          },
          actions: [{ type: 'debugLog', message: 'double' }],
        }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_input_pressed("KeyW", function()')
    expect(lua).not.toContain('_logic_reg_input_pressed("ControlLeft"')
    expect(lua).toMatch(
      /wasKeyPressed\("KeyW"\).*and.*input\.isKeyDown\("ControlLeft"\)/s,
    )
  })

  it('else branch emits when Also require checks fail', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          onlyIfEnabled: true,
          conditions: [
            { type: 'compareVariable', key: 'hasKey', operator: '==', value: 1 },
          ],
          elseEnabled: true,
          elseActions: [{ type: 'debugLog', message: 'locked' }],
          trigger: { type: 'onUpdate' },
          actions: [{ type: 'debugLog', message: 'open' }],
        }),
      ]),
    ])
    expect(lua).toMatch(/if \(global\.get\("hasKey"\) == 1\) then/)
    expect(lua).toContain('debug.log("open")')
    expect(lua).toMatch(/else[\s\S]*debug\.log\("locked"\)/)
  })

  it('flat conditionsOperator NOT negates combined checks', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          onlyIfEnabled: true,
          conditionsOperator: 'NOT',
          conditions: [
            { type: 'isPlatformerGrounded', target: 'self' },
            { type: 'compareVariable', key: 'x', operator: '==', value: 1 },
          ],
          trigger: { type: 'onUpdate' },
          actions: [{ type: 'debugLog', message: 'x' }],
        }),
      ]),
    ])
    expect(lua).toMatch(/not \(.*platformer\.isGrounded.*or.*global\.get/s)
  })

  it('flat conditionsOperator OR joins checks with or', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          onlyIfEnabled: true,
          conditionsOperator: 'OR',
          conditions: [
            { type: 'isKeyDown', keyCode: 'KeyW' },
            { type: 'isKeyDown', keyCode: 'Space' },
          ],
          actions: [{ type: 'debugLog', message: 'either' }],
        }),
      ]),
    ])
    expect(lua).toMatch(
      /input\.isKeyDown\("KeyW"\).*or.*input\.isKeyDown\("Space"\)/s,
    )
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
    expect(lua).toContain('global.add("score", 1)')
  })

  it('onTimer non-repeat on global board uses registration path', () => {
    // Global boards have no per-entity clock: the cheaper time.after
    // registration is correct (one shared timer for the scene).
    const lua = compileLogicBoard([
      {
        boardId: 'b1',
        target: { type: 'global' },
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

  it('onTimer repeat on global board uses registration path', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'b1',
        target: { type: 'global' },
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

  it('onTimer on object_type board uses per-instance tick timers', () => {
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
    expect(everyCount).toBe(0)
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
            { type: 'spawnEntityAtPointer', className: 'Coin' },
            { type: 'setVariable', key: 'level', value: 2 },
            { type: 'emitEvent', name: 'wave_cleared' },
            { type: 'emitEvent', name: 'dmg', payloadKey: 'amount', payloadValue: 5 },
            { type: 'debugLog', message: 'done' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('global.set("lives", 3)')
    expect(lua).toContain('global.add("score", 10)')
    expect(lua).toContain('entity.setPosition(self, 5, 6)')
    expect(lua).toContain('entity.setVelocity(9, 1, -2)')
    expect(lua).toContain('audio.playSound("sfx/jump.ogg", 0.5, 1.2)')
    expect(lua).toContain('audio.playMusic("bgm.ogg", false)')
    expect(lua).toContain('audio.stopAll()')
    expect(lua).toContain('entity.destroy((pool.getAll("Bullet")[1]))')
    expect(lua).toContain('object.spawn("Enemy", 100, 0)')
    expect(lua).toContain('local _mx,_my=input.mouseWorld()')
    expect(lua).toContain('object.spawn("Coin", _mx, _my)')
    expect(lua).toContain('global.set("level", 2)')
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
  // emit an ArtCade marker comment so the issue surfaces in the Lua preview AND the
  // compiler keeps producing a parseable script for the rest of the board.
  it('unknown action enum produces a marker comment instead of crashing', () => {
    // moveInDirection with an unrecognised direction.
    const board1 = {
      boardId: 'b', target: { type: 'object_type', objectTypeId: 'Player' },
      events: [{
        id: 'e', enabled: true,
        trigger: { type: 'onSpawn' },
        // direction is typed as a union; cast through unknown for the test.
        actions: [{ type: 'moveInDirection', target: 'self',
                    direction: 'diagonal-up-left', speed: 100 } as unknown as never],
      }],
    } as never
    const lua = compileLogicBoard([board1])
    // The compiler must not throw and must not embed `undefined` anywhere.
    expect(lua).not.toContain('undefined')
    // Surface the dropped action so the user can fix it.
    expect(lua).toContain('-- TODO ArtCade: unknown action "moveInDirection"')

    // Completely unknown top-level action type.
    const board2 = {
      boardId: 'b2', target: { type: 'object_type', objectTypeId: 'Player' },
      events: [{
        id: 'e2', enabled: true,
        trigger: { type: 'onSpawn' },
        actions: [{ type: 'newFutureAction', target: 'self' } as unknown as never],
      }],
    } as never
    const lua2 = compileLogicBoard([board2])
    expect(lua2).not.toContain('undefined')
    expect(lua2).toContain('-- TODO ArtCade: unknown action "newFutureAction"')
  })
})

describe('compileLogicBoard — realistic example', () => {
  it('jump on Space + coin pickup', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'player_controller',
        target: { type: 'object_type', objectTypeId: 'Player' },
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
    expect(lua).toContain('global.add("coins", 1)')
    expect(lua).toContain('audio.playSound("sfx/coin.ogg", 1, 1)')
  })

  it('uses custom board names in generated comments while keeping ids internal', () => {
    const lua = compileLogicBoard([
      {
        boardId: 'board_mplxyz_1',
        name: 'Player movement',
        target: { type: 'object_type', objectTypeId: 'Player' },
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
        target: { type: 'object_type', objectTypeId: 'Player' },
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
        target: { type: 'object_type', objectTypeId: 'Player' },
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
    expect(lua).toContain('input.mouseWorld()')
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

  it('onObjectClick compiles a click plus object hit check', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onObjectClick', button: 'left', radius: 24 },
             actions: [{ type: 'debugLog', message: 'clicked' }] }),
      ]),
    ])
    expect(lua).toContain('input.mouseButtonDown(0)')
    expect(lua).toContain('input.mouseWorld()')
    expect(lua).toContain('<= 576')
    expect(lua).toContain('debug.log("clicked")')
  })

  it('object hover triggers compile pointer enter and leave edges', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onObjectHoverEnter', radius: 12 },
             actions: [{ type: 'debugLog', message: 'enter' }] }),
        ev({ trigger: { type: 'onObjectHoverExit', radius: 12 },
             actions: [{ type: 'debugLog', message: 'leave' }] }),
      ]),
    ])
    expect(lua).toContain('<= 144')
    expect(lua).toContain('_ohit and not _mb[_ohk]')
    expect(lua).toContain('(not _ohit) and _mb[_ohk]')
    expect(lua).toContain('debug.log("enter")')
    expect(lua).toContain('debug.log("leave")')
  })

  it('onMessage registers an event.on listener in init', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onMessage', messageName: 'player_hit' },
             actions: [{ type: 'debugLog', message: 'hit' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_message("player_hit", function(_message)')
    expect(lua).toContain('debug.log("hit")')
  })

  it('onDialogMessage registers the same runtime message listener', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onDialogMessage', messageName: 'QuestAccepted' },
             actions: [{ type: 'debugLog', message: 'quest' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_message("QuestAccepted", function(_message)')
    expect(lua).toContain('debug.log("quest")')
  })

  it('startDialog emits dialog.start on target entity', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTriggerEnter' },
          actions: [{ type: 'startDialog', target: 'self', dialogId: 'innkeeper' }],
        }),
      ]),
    ])
    expect(lua).toContain('dialog.start(self, "innkeeper")')
  })

  it('startDialog can emit dialog.startComponent from the target Dialog component', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTriggerEnter' },
          actions: [{ type: 'startDialog', target: 'self', source: 'component' }],
        }),
      ]),
    ])
    expect(lua).toContain('dialog.startComponent(self)')
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

  it('widened number fields bind to value sources (variables/expressions)', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' }, actions: [
          { type: 'setRotation', target: 'self', angle: { source: 'global', key: 'aim' } },
          { type: 'applyImpulse', target: 'self', ix: { source: 'global', key: 'kick' }, iy: 0 },
        ] }),
      ]),
    ])
    // The bound variable flows through numberSourceExpr into the call site.
    expect(lua).toContain('global.get("aim")')
    expect(lua).toContain('global.get("kick")')
    expect(lua).toContain('entity.setRotation(self,')
  })

  it('cameraShake keeps literal output but clamps dynamic trauma in Lua', () => {
    const literal = compileLogicBoard([
      board([ev({ trigger: { type: 'onUpdate' }, actions: [{ type: 'cameraShake', trauma: 8.5 }] })]),
    ])
    // Literal path is byte-identical to the legacy JS-side clamp.
    expect(literal).toContain('camera.shake(1, 0.5)')

    const dynamic = compileLogicBoard([
      board([ev({ trigger: { type: 'onUpdate' }, actions: [
        { type: 'cameraShake', trauma: { source: 'global', key: 'hit' } },
      ] })]),
    ])
    // Dynamic path moves the 0–1 clamp into the emitted Lua.
    expect(dynamic).toContain('math.min(1, math.max(0,')
    expect(dynamic).toContain('global.get("hit")')
  })
})

describe('Hot-reload safety — handler unsubscribe tracking', () => {
  it('emits module-owned unsubscribe disposal', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onSpawn' },
             actions: [{ type: 'debugLog', message: 'spawned' }] }),
      ]),
    ])
    expect(lua).toContain('local module = { _unsubs = {} }')
    expect(lua).toContain('pcall(module._unsubs[i])')
    // Trackers and helpers exist.
    expect(lua).toContain('local function _logic_track(unsub)')
    expect(lua).toContain('local function _logic_bag_unsub(bag, key, fn)')
    expect(lua).toContain('function module.dispose()')
    expect(lua).toContain('module._unsubs = {}')
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
      // onTimer on a global board → registration path (time.every).
      {
        boardId: 'b2',
        target: { type: 'global' as const },
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
    expect(lua).toContain('_logic_reg_message("hit", function(_message)')
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
    expect(lua).toContain('_logic_reg_message("level_complete", function(_message)')
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
    expect(lua).toContain('global.add("score", 1)')
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
        ev({ trigger: { type: 'onCollisionEnter', withClass: 'Coin' },
             actions: [{ type: 'debugLog', message: 'x' }] }),
      ]),
    ])
    expect(lua).toContain('local _collision_was_touching = {}')
    expect(lua).toContain('local function _logic_collision_edge(eid, cls, want_enter)')
  })

  it('onCollisionEnter sets other via collision.firstTouching for destroy other', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onCollisionEnter', withClass: 'Coin' },
          actions: [{ type: 'destroyEntity', target: 'other' }],
        }),
      ]),
    ])
    expect(lua).toContain('other = collision.firstTouching(self, "Coin")')
    expect(lua).toContain('entity.destroy(other)')
    expect(lua).toContain('_logic_collision_edge(self, "Coin", true)')
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

  it('onDestroy on object_type board registers lifecycle.onDestroy via project class', () => {
    const project = miniProject()
    const lua = compileLogicBoard([
      {
        boardId: 'hero',
        target: { type: 'object_type', objectTypeId: 'Player' },
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

  it('moveInDirection forward derives heading from the flip flag', () => {
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
    expect(lua).toContain('entity.flipX(self)')
    expect(lua).toContain('entity.setVelocity')
    expect(lua).not.toContain('entity.scale(self)')
  })

  it('spawnEntity inheritFlip copies the flip flag (not the scale sign)', () => {
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
    expect(lua).toContain('entity.flipX(self)')
    expect(lua).toContain('entity.setFlip(_nid')
    expect(lua).not.toContain('entity.setScale(_nid')
  })

  it('wait.then runs before post-wait tail actions (concat semantics)', () => {
    const waitWithBranch = JSON.parse(
      '{"type":"wait","seconds":1,"then":[{"type":"debugLog","message":"nested"}]}',
    ) as LogicEvent['actions'][number]
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'debugLog', message: 'before' },
            waitWithBranch,
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

  it('repeatTimes runs following linear actions in a for loop when interval is 0', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'debugLog', message: 'before' },
            { type: 'repeatTimes', count: 3, intervalSeconds: 0 },
            { type: 'debugLog', message: 'blink' },
            { type: 'debugLog', message: 'after' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('debug.log("before")')
    expect(lua).toContain('for _logic_rep = 1, 3 do')
    expect(lua).toContain('debug.log("blink")')
    expect(lua).toContain('debug.log("after")')
    const loopStart = lua.indexOf('for _logic_rep = 1, 3 do')
    const blinkIdx = lua.indexOf('debug.log("blink")')
    const afterIdx = lua.indexOf('debug.log("after")')
    expect(blinkIdx).toBeGreaterThan(loopStart)
    expect(afterIdx).toBeGreaterThan(blinkIdx)
    const between = lua.slice(loopStart, afterIdx)
    expect(between).toContain('for _logic_rep = 1, 3 do')
    expect(between).toContain('debug.log("blink")')
    expect(between.split('debug.log("blink")').length - 1).toBe(1)
  })

  it('repeatTimes spaces iterations with time.after when interval > 0', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'repeatTimes', count: 3, intervalSeconds: 0.5 },
            { type: 'debugLog', message: 'blink' },
          ],
        }),
      ]),
    ])
    expect(lua).not.toContain('for _logic_rep = 1, 3 do')
    expect(lua).toContain('local function _logic_rep_step_1(n)')
    expect(lua).toContain('if n > 3 then return end')
    expect(lua).toContain('time.after(0.5, function() _logic_rep_step_1(n + 1) end)')
    expect(lua).toContain('_logic_rep_step_1(1)')
    expect(lua).toContain('debug.log("blink")')
  })

  it('repeatTimes uses nested actions when provided', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            {
              type: 'repeatTimes',
              count: 2,
              intervalSeconds: 0,
              actions: [{ type: 'debugLog', message: 'inner' }],
            },
            { type: 'debugLog', message: 'tail' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('for _logic_rep = 1, 2 do')
    expect(lua).toContain('debug.log("inner")')
    expect(lua).toContain('debug.log("tail")')
    expect(lua.indexOf('debug.log("tail")')).toBeGreaterThan(lua.indexOf('for _logic_rep = 1, 2 do'))
  })

  it('repeatTimes clamps invalid count to at least 1', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'repeatTimes', count: 0, intervalSeconds: 0.5 },
            { type: 'debugLog', message: 'once' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('if n > 1 then return end')
    expect(lua).toContain('time.after(0.5, function()')
  })

  it('repeatTimes onStart repeats cameraShake with default interval when interval omitted', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'repeatTimes', count: 5 },
            { type: 'cameraShake', trauma: 0.5 },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('local function _logic_rep_step_1(n)')
    expect(lua).toContain('if n > 5 then return end')
    expect(lua).toContain('camera.shake(0.5, 0.5)')
    expect(lua).toContain('time.after(0.5, function() _logic_rep_step_1(n + 1) end)')
  })

  it('nested timed repeatTimes inside wait.then use unique step function names', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            {
              type: 'wait',
              seconds: 0.1,
              then: [
                { type: 'repeatTimes', count: 2, intervalSeconds: 0.5, actions: [{ type: 'debugLog', message: 'a' }] },
                { type: 'repeatTimes', count: 2, intervalSeconds: 0.5, actions: [{ type: 'debugLog', message: 'b' }] },
              ],
            },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('local function _logic_rep_step_1(n)')
    expect(lua).toContain('local function _logic_rep_step_2(n)')
    expect(lua).not.toMatch(/local function _logic_rep_step_1\(n\)[\s\S]*local function _logic_rep_step_1\(n\)/)
  })

  it('repeatTimes body stops at the next wait control action', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'repeatTimes', count: 2, intervalSeconds: 0 },
            { type: 'debugLog', message: 'in-loop' },
            { type: 'wait', seconds: 0.5 },
            { type: 'debugLog', message: 'never' },
          ],
        }),
      ]),
    ])
    const loopStart = lua.indexOf('for _logic_rep = 1, 2 do')
    const waitIdx = lua.indexOf('time.after(0.5, function()')
    expect(loopStart).toBeGreaterThan(-1)
    expect(waitIdx).toBeGreaterThan(loopStart)
    expect(lua.slice(loopStart, waitIdx)).toContain('debug.log("in-loop")')
    expect(lua).toContain('debug.log("never")')
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

  it('onAnimationStart/Loop/Change register their dedicated animation handlers', () => {
    const lua = compileLogicBoard([
      board([
        ev({ id: 'as', trigger: { type: 'onAnimationStart', clipName: 'attack' },
             actions: [{ type: 'debugLog', message: 'start' }] }),
        ev({ id: 'al', trigger: { type: 'onAnimationLoop', clipName: 'walk' },
             actions: [{ type: 'debugLog', message: 'loop' }] }),
        ev({ id: 'ac', trigger: { type: 'onAnimationChange', clipName: 'run' },
             actions: [{ type: 'debugLog', message: 'change' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_anim_start("Player", "attack", function(entityId, clip)')
    expect(lua).toContain('_logic_reg_anim_loop("Player", "walk", function(entityId, clip)')
    expect(lua).toContain('_logic_reg_anim_change("Player", "run", function(entityId, clip)')
    // Each helper is emitted in the prelude only when referenced.
    expect(lua).toContain('animation.onStart(source, clip, fn)')
    expect(lua).toContain('animation.onLoop(source, clip, fn)')
    expect(lua).toContain('animation.onChanged(source, clip, fn)')
  })

  it('onAnimationFrame filters to the target frame inside the closure', () => {
    const lua = compileLogicBoard([
      board([
        ev({ id: 'af', trigger: { type: 'onAnimationFrame', clipName: 'attack', frameIndex: 3 },
             actions: [{ type: 'debugLog', message: 'hit' }] }),
      ]),
    ])
    expect(lua).toContain('_logic_reg_anim_frame("Player", "attack", function(entityId, clip, frame)')
    expect(lua).toContain('if frame == 3 then')
    expect(lua).toContain('debug.log("hit")')
  })
})

describe('RULE alias integrity', () => {
  // Property: every `RULE.<slug>` referenced in the compiled output must have
  // a matching binding inside the `local RULE = { ... }` table. Catches drift
  // between ruleKeyExpr (event-slugs.ts) and buildHeader (compiler-prelude.ts)
  // if a future patch updates one without the other.

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
  it('cameraShake without trauma defaults intensity to 0.35', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onUpdate' },
             actions: [{ type: 'cameraShake' } as never] }),
      ]),
    ])
    expect(lua).toContain('camera.shake(0.35, 0.5)')
    expect(lua).not.toContain('camera.shake(undefined')
    expect(lua).toMatch(/camera\.shake\(0\.35, 0\.5\)/)
    expect(lua).not.toContain('NaN')
  })

  it('cameraShake emits custom durationSeconds', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [{ type: 'cameraShake', trauma: 0.5, durationSeconds: 2 }],
        }),
      ]),
    ])
    expect(lua).toContain('camera.shake(0.5, 2)')
  })

  it('cameraShake clamps trauma above 1 in emitted Lua', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [{ type: 'cameraShake', trauma: 8.5 }],
        }),
      ]),
    ])
    expect(lua).toContain('camera.shake(1, 0.5)')
  })

  it('onStart-only cameraShake runs init at script load (edit-mode hot reload)', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [{ type: 'cameraShake', trauma: 0.6 }],
        }),
      ]),
    ])
    expect(lua).toContain('module.requiresTick = false')
    expect(lua).toContain('camera.shake(0.6, 0.5)')
    const initDef = lua.indexOf('function module.initialize()')
    const shakeCall = lua.indexOf('camera.shake(0.6, 0.5)')
    expect(shakeCall).toBeGreaterThan(initDef)
    expect(shakeCall).toBeLessThan(lua.indexOf('function module.tick(dt)'))
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
    expect(lua).toContain('(global.get("k") == 1)')
    expect(lua).not.toContain('os.exit')
  })
})

describe('logicDebugTrace', () => {
  it('emits debug.log for condition pass/fail when enabled', () => {
    const lua = compileLogicBoard(
      [
        board([
          ev({
            trigger: { type: 'onUpdate' },
            conditions: [{ type: 'compareVariable', key: 'hp', operator: '>', value: 0 }],
            actions: [{ type: 'debugLog', message: 'alive' }],
          }),
        ]),
      ],
      null,
      { logicDebugTrace: true },
    )
    expect(lua).toContain('[logic]')
    expect(lua).toContain('condition pass')
    expect(lua).toContain('condition fail')
  })
})

describe('Value Sources', () => {
  it('emits global, entity, message, and deterministic random sources', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onMessage', messageName: 'configure' },
          actions: [
            { type: 'setVariable', key: 'fromGlobal', value: { source: 'global', key: 'score' } },
            { type: 'setVariable', key: 'fromMessage', value: { source: 'message', key: 'amount' } },
            {
              type: 'setVariable',
              key: 'fromEntity',
              value: { source: 'entity', target: 'self', property: 'positionX' },
            },
            { type: 'setVariable', key: 'die', value: { source: 'random', min: 6, max: 1 } },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('function(_message)')
    expect(lua).toContain('global.get("score")')
    expect(lua).toContain('_message["amount"]')
    expect(lua).toContain('local _target=self; if _target==nil then return 0 end; local _x,_y=entity.position(_target)')
    expect(lua).toContain('_logic_random_int(6, 1)')
    expect(lua).not.toContain('math.random')
  })
})

describe('camera follow contract', () => {
  it('keeps one-shot centering separate from persistent follow control', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [
            { type: 'centerCameraOn', target: 'self' },
            { type: 'followCamera', target: { entityId: 7 } },
            { type: 'stopCameraFollow' },
            { type: 'useDefaultCameraTarget' },
          ],
        }),
      ]),
    ])

    expect(lua).toContain('camera.centerOn(self)')
    expect(lua).toContain('camera.follow(7)')
    expect(lua).toContain('camera.stopFollowing()')
    expect(lua).toContain('camera.useDefaultTarget()')
  })
})
