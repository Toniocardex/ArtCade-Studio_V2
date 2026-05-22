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
    expect(lua).not.toContain('pool.getAll')
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
    expect(mk('pressed')).toContain('input.onPressed("KeyW", function()')
    expect(mk('released')).toContain('input.onReleased("KeyW", function()')
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
    expect(lua).toContain('_logic_on["e1"] ~= false')
    expect(lua).toContain('state.add("score", 1)')
  })

  it('onTimer non-repeat registers a one-shot timer', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTimer', seconds: 2, repeat: false },
          actions: [{ type: 'debugLog', message: 'tick' }],
        }),
      ]),
    ])
    expect(lua).toContain('time.after(2, function()')
    expect(lua).toContain('debug.log("tick")')
  })

  it('onTimer repeat registers an interval timer', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onTimer', seconds: 1.5, repeat: true },
          actions: [{ type: 'debugLog', message: 'tick' }],
        }),
      ]),
    ])
    expect(lua).toContain('time.every(1.5, function()')
    expect(lua).toContain('debug.log("tick")')
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
    expect(lua).toContain('input.onPressed("Space", function()')
    expect(lua).toContain('entity.setVelocity(self, 0, -400)')
    expect(lua).toContain('collision.touchingClass(self, "Coin")')
    expect(lua).toContain('state.add("coins", 1)')
    expect(lua).toContain('audio.playSound("sfx/coin.ogg", 1, 1)')
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
    expect(lua).toContain('_logic_on["A"] ~= false')
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
    expect(lua).toContain('event.on("player_hit", function()')
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

describe('Logic Components — Phase C (engine-hook triggers)', () => {
  it('onSpawn registers a lifecycle handler', () => {
    const lua = compileLogicBoard([
      board([
        ev({ trigger: { type: 'onSpawn', className: 'Player' },
             actions: [{ type: 'debugLog', message: 'spawned' }] }),
      ]),
    ])
    expect(lua).toContain('lifecycle.onSpawn("Player", function(entityId, tags)')
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
    expect(lua).toContain('lifecycle.onDestroy("Player", function(entityId, tags)')
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
    expect(lua).toContain('sensor.onEnter("Player", "Zone", function(entityId, otherId, tag)')
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
    expect(lua).toContain('sensor.onExit("Player", "Zone", function(entityId, otherId, tag)')
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

  it('onAnimationEnd polls while onDestroy registers lifecycle handler', () => {
    const lua = compileLogicBoard([
      board([
        ev({ id: 'ae', trigger: { type: 'onAnimationEnd', clipName: 'die' },
             actions: [{ type: 'debugLog', message: 'done' }] }),
        ev({ id: 'od', trigger: { type: 'onDestroy' },
             actions: [{ type: 'debugLog', message: 'bye' }] }),
      ]),
    ])
    expect(lua).toContain('animation.pollFinished()')
    expect(lua).toContain('lifecycle.onDestroy("Player", function(entityId, tags)')
    expect(lua).toContain('af.clip == "die"')
    expect(lua).toContain('debug.log("done")')
    expect(lua).toContain('debug.log("bye")')
  })
})
