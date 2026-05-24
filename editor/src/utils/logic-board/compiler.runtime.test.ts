// ---------------------------------------------------------------------------
// Runtime validation of the Logic Board compiler.
//
// Instead of only string-matching the generated Lua (compiler.test.ts), this
// suite EXECUTES it in a real Lua 5.4 VM (wasmoon — the same Lua version the
// C++ runtime embeds) with mocked API tables that mirror the runtime prelude
// (state/entity/audio/collision/input/pool/object/debug).
//
// This proves the generated Lua is both syntactically valid AND semantically
// correct under realistic tick(dt) scenarios.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { LuaFactory } from 'wasmoon'
import { compileLogicBoard } from './compiler'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'

function ev(
  p: Partial<LogicEvent> & Pick<LogicEvent, 'trigger' | 'actions'>,
): LogicEvent {
  return { id: 'e1', enabled: true, ...p }
}

/** Mutable harness mirroring the runtime API surface. */
interface Harness {
  vars: Record<string, number | string | boolean>
  keysDown: Set<string>
  keysPressed: Set<string>
  keysReleased: Set<string>
  touching: Set<string> // classNames `self` is currently touching
  pools: Record<string, number[]>
  calls: {
    setVelocity: Array<{ id: number; vx: number; vy: number }>
    setPosition: Array<{ id: number; x: number; y: number }>
    destroy: number[]
    spawn: Array<{ cls: string; x: number; y: number }>
    playSound: Array<{ path: string; vol: number; pitch: number }>
    playMusic: Array<{ path: string; loop: boolean }>
    stopAll: number
    stopMusic: number
    pauseMusic: number
    resumeMusic: number
    playAnimation: Array<{ id: number; clip: string }>
    log: string[]
  }
  inputPressedHandlers: Record<string, Array<() => void>>
  inputReleasedHandlers: Record<string, Array<() => void>>
}

function newHarness(pools: Record<string, number[]> = { Player: [1] }): Harness {
  return {
    vars: {},
    keysDown: new Set(),
    keysPressed: new Set(),
    keysReleased: new Set(),
    touching: new Set(),
    pools,
    calls: {
      setVelocity: [],
      setPosition: [],
      destroy: [],
      spawn: [],
      playSound: [],
      playMusic: [],
      stopAll: 0,
      stopMusic: 0,
      pauseMusic: 0,
      resumeMusic: 0,
      playAnimation: [],
      log: [],
    },
    inputPressedHandlers: {},
    inputReleasedHandlers: {},
  }
}

const factory = new LuaFactory()

/** Compile a board, load it in Lua with mocked APIs, return a tick() driver. */
async function makeRunner(boards: LogicBoard[]) {
  const lua = await factory.createEngine()
  const h = newHarness(
    Object.fromEntries(
      boards
        .filter((b) => b.target.type === 'entity_class' && b.target.className)
        .map((b) => [b.target.className as string, [1]]),
    ),
  )
  if (Object.keys(h.pools).length === 0) h.pools = { Player: [1] }

  lua.global.set('state', {
    get: (k: string) => h.vars[k] ?? 0,
    set: (k: string, v: number | string | boolean) => {
      h.vars[k] = v
    },
    add: (k: string, n: number) => {
      const cur = typeof h.vars[k] === 'number' ? (h.vars[k] as number) : 0
      h.vars[k] = cur + n
      return h.vars[k]
    },
  })
  lua.global.set('entity', {
    setVelocity: (id: number, vx: number, vy: number) =>
      h.calls.setVelocity.push({ id, vx, vy }),
    setPosition: (id: number, x: number, y: number) =>
      h.calls.setPosition.push({ id, x, y }),
    destroy: (id: number) => h.calls.destroy.push(id),
  })
  lua.global.set('audio', {
    playSound: (path: string, vol: number, pitch: number) =>
      h.calls.playSound.push({ path, vol, pitch }),
    playMusic: (path: string, loop: boolean) =>
      h.calls.playMusic.push({ path, loop }),
    stopAll: () => {
      h.calls.stopAll++
    },
    stopMusic: () => {
      h.calls.stopMusic++
    },
    pauseMusic: () => {
      h.calls.pauseMusic++
    },
    resumeMusic: () => {
      h.calls.resumeMusic++
    },
  })
  lua.global.set('object', {
    spawn: (cls: string, x: number, y: number) => {
      h.calls.spawn.push({ cls, x, y })
      return 999
    },
  })
  lua.global.set('collision', {
    touchingClass: (_id: number, cls: string) => h.touching.has(cls),
  })
  lua.global.set('input', {
    isKeyDown: (k: string) => h.keysDown.has(k),
    wasKeyPressed: (k: string) => h.keysPressed.has(k),
    wasKeyReleased: (k: string) => h.keysReleased.has(k),
    onPressed: (k: string, fn: () => void) => {
      ;(h.inputPressedHandlers[k] ??= []).push(fn)
    },
    onReleased: (k: string, fn: () => void) => {
      ;(h.inputReleasedHandlers[k] ??= []).push(fn)
    },
  })
  lua.global.set('pool', {
    getAll: (cls: string) => h.pools[cls] ?? [],
  })
  lua.global.set('debug', {
    log: (m: string) => h.calls.log.push(m),
  })

  lua.global.set('sensor', {
    poll: () => [],
    onEnter: () => {},
    onExit: () => {},
  })
  lua.global.set('lifecycle', {
    pollDestroyed: () => [],
    onSpawn: () => {},
    onDestroy: () => {},
  })
  lua.global.set('animation', {
    pollFinished: () => [],
    play: (id: number, clip: string) => h.calls.playAnimation.push({ id, clip }),
  })
  await lua.doString(`
    time = {}
    local _timers = {}
    function time.after(seconds, cb)
      table.insert(_timers, { remaining = seconds, interval = nil, cb = cb, once = true })
    end
    function time.every(seconds, cb)
      table.insert(_timers, { remaining = seconds, interval = seconds, cb = cb, once = false })
    end
    function __test_time_update(dt)
      local i = 1
      while i <= #_timers do
        local timer = _timers[i]
        timer.remaining = timer.remaining - dt
        if timer.remaining <= 0 then
          timer.cb()
          if timer.once then
            table.remove(_timers, i)
          else
            timer.remaining = timer.remaining + timer.interval
            i = i + 1
          end
        else
          i = i + 1
        end
      end
    end
  `)

  const code = compileLogicBoard(boards)
  await lua.doString(code) // throws on Lua syntax error → validates syntax
  const tick = lua.global.get('tick') as (dt: number) => void
  const timeUpdate = lua.global.get('__test_time_update') as (dt: number) => void

  return {
    h,
    code,
    tick: (dt = 1 / 60) => {
      for (const key of h.keysPressed) {
        for (const fn of h.inputPressedHandlers[key] ?? []) fn()
      }
      for (const key of h.keysReleased) {
        for (const fn of h.inputReleasedHandlers[key] ?? []) fn()
      }
      timeUpdate(dt)
      tick(dt)
      // edge-state (pressed/released) lasts one frame, like the real runtime
      h.keysPressed.clear()
      h.keysReleased.clear()
    },
    close: () => lua.global.close(),
  }
}

describe('runtime: syntax validity', () => {
  it('every MVP construct produces loadable Lua 5.4', async () => {
    const r = await makeRunner([
      {
        boardId: 'all',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({ id: 's', trigger: { type: 'onStart' }, actions: [{ type: 'debugLog', message: 'init' }] }),
          ev({
            id: 'u',
            trigger: { type: 'onUpdate' },
            conditionRoot: {
              kind: 'group',
              operator: 'OR',
              statements: [
                { kind: 'leaf', condition: { type: 'chance', percent: 100 } },
                { kind: 'leaf', condition: { type: 'compareVariable', key: 'x', operator: '>=', value: 0 } },
              ],
            },
            actions: [
              { type: 'setVariable', key: 'a', value: 1 },
              { type: 'addVariable', key: 'a', amount: 2 },
              { type: 'setPosition', target: 'self', x: 1, y: 2 },
              { type: 'setVelocity', target: { entityId: 3 }, vx: 4, vy: 5 },
              { type: 'playSound', path: 's.ogg' },
              { type: 'playMusic', path: 'm.ogg', loop: true },
              { type: 'stopAllAudio' },
              { type: 'destroyEntity', target: { className: 'X', first: true } },
              { type: 'spawnEntity', className: 'Y', x: 0, y: 0 },
            ],
          }),
          ev({ id: 't', trigger: { type: 'onTimer', seconds: 1, repeat: true }, actions: [{ type: 'debugLog', message: 'tick' }] }),
          ev({ id: 'i', trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' }, actions: [{ type: 'debugLog', message: 'jump' }] }),
          ev({ id: 'c', trigger: { type: 'onCollision', withClass: 'Coin' }, actions: [{ type: 'debugLog', message: 'hit' }] }),
        ],
      },
    ])
    expect(typeof r.tick).toBe('function')
    r.tick() // must not throw
    r.close()
  })
})

describe('runtime: onStart runs exactly once', () => {
  it('init fires on first tick only', async () => {
    const r = await makeRunner([
      {
        boardId: 'b',
        target: { type: 'entity_class', className: 'Player' },
        events: [ev({ trigger: { type: 'onStart' }, actions: [{ type: 'addVariable', key: 'n', amount: 1 }] })],
      },
    ])
    r.tick()
    r.tick()
    r.tick()
    expect(r.h.vars.n).toBe(1)
    r.close()
  })
})

describe('runtime: jump on Space pressed', () => {
  it('setVelocity only when wasKeyPressed is true that frame', async () => {
    const r = await makeRunner([
      {
        boardId: 'pc',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
            actions: [{ type: 'setVelocity', target: 'self', vx: 0, vy: -400 }],
          }),
        ],
      },
    ])
    r.tick() // no key
    expect(r.h.calls.setVelocity).toHaveLength(0)

    r.h.keysPressed.add('Space')
    r.tick() // key pressed this frame → fires for self id=1
    expect(r.h.calls.setVelocity).toEqual([{ id: 1, vx: 0, vy: -400 }])

    r.tick() // pressed cleared → no repeat
    expect(r.h.calls.setVelocity).toHaveLength(1)
    r.close()
  })
})

describe('runtime: coin pickup on collision', () => {
  it('increments coins and plays sound while touching Coin', async () => {
    const r = await makeRunner([
      {
        boardId: 'pc',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            trigger: { type: 'onCollision', withClass: 'Coin' },
            actions: [
              { type: 'addVariable', key: 'coins', amount: 1 },
              { type: 'playSound', path: 'sfx/coin.ogg' },
            ],
          }),
        ],
      },
    ])
    r.tick() // not touching
    expect(r.h.vars.coins ?? 0).toBe(0)

    r.h.touching.add('Coin')
    r.tick() // touching → +1, sound
    expect(r.h.vars.coins).toBe(1)
    expect(r.h.calls.playSound).toEqual([{ path: 'sfx/coin.ogg', vol: 1, pitch: 1 }])
    r.close()
  })
})

describe('runtime: onTimer repeat', () => {
  it('fires every N seconds and resets', async () => {
    const r = await makeRunner([
      {
        boardId: 'b',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            trigger: { type: 'onTimer', seconds: 0.5, repeat: true },
            actions: [{ type: 'addVariable', key: 'ticks', amount: 1 }],
          }),
        ],
      },
    ])
    // First tick registers the event timer; after that it fires at 0.5s and 1.0s.
    for (let i = 0; i < 5; i++) r.tick(0.25)
    expect(r.h.vars.ticks).toBe(2)
    r.close()
  })

  it('non-repeat fires once then stays latched', async () => {
    const r = await makeRunner([
      {
        boardId: 'b',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            trigger: { type: 'onTimer', seconds: 0.3, repeat: false },
            actions: [{ type: 'addVariable', key: 'n', amount: 1 }],
          }),
        ],
      },
    ])
    for (let i = 0; i < 10; i++) r.tick(0.1)
    expect(r.h.vars.n).toBe(1)
    r.close()
  })
})

describe('runtime: conditions gate actions', () => {
  it('compareVariable blocks until satisfied', async () => {
    const r = await makeRunner([
      {
        boardId: 'b',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
            trigger: { type: 'onUpdate' },
            conditions: [{ type: 'compareVariable', key: 'hp', operator: '>', value: 0 }],
            actions: [{ type: 'debugLog', message: 'alive' }],
          }),
        ],
      },
    ])
    r.h.vars.hp = 0
    r.tick()
    expect(r.h.calls.log).toHaveLength(0)

    r.h.vars.hp = 10
    r.tick()
    expect(r.h.calls.log).toEqual(['alive'])
    r.close()
  })

  it('OR/AND tree evaluates correctly', async () => {
    const r = await makeRunner([
      {
        boardId: 'b',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({
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
            actions: [{ type: 'debugLog', message: 'open' }],
          }),
        ],
      },
    ])
    r.tick() // all 0 → closed
    expect(r.h.calls.log).toHaveLength(0)

    r.h.vars.thief = 1
    r.tick() // thief only → AND fails, OR fails
    expect(r.h.calls.log).toHaveLength(0)

    r.h.vars.pick = 1
    r.tick() // thief AND pick → opens
    expect(r.h.calls.log).toEqual(['open'])

    r.h.vars.thief = 0
    r.h.vars.pick = 0
    r.h.vars.hasKey = 1
    r.tick() // hasKey → opens again
    expect(r.h.calls.log).toEqual(['open', 'open'])
    r.close()
  })
})

describe('runtime: disabled events are inert', () => {
  it('disabled event never executes', async () => {
    const r = await makeRunner([
      {
        boardId: 'b',
        target: { type: 'entity_class', className: 'Player' },
        events: [
          ev({ enabled: false, trigger: { type: 'onUpdate' }, actions: [{ type: 'debugLog', message: 'NO' }] }),
        ],
      },
    ])
    r.tick()
    r.tick()
    expect(r.h.calls.log).toHaveLength(0)
    r.close()
  })
})
