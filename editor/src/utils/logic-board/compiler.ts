// ---------------------------------------------------------------------------
// Logic Board compiler — turns a LogicBoardDoc into a single Lua source string.
//
// Design constraints (verified against the real runtime):
//   • The C++ runtime calls `tick(dt)` for compatible polling blocks, while
//     event-first triggers register handlers during `_logic_init()`.
//   • The generated Lua uses the real dot-notation API prelude exposed by
//     runtime-cpp/src/modules/game-api/src/*.cpp:
//       state.get/set/add, entity.setPosition/setVelocity/destroy,
//       audio.playSound/playMusic/stopAll, object.spawn,
//       collision.touchingClass, input.isKeyDown/onPressed/onReleased,
//       sensor.onEnter/onExit, lifecycle.onSpawn/onDestroy, pool.getAll,
//       debug.log
//   • Entities are addressed via the board target's class pool; `self` is the
//     current entity in that pool's iteration.
//
// The runtime never parses JSON: this string is sent through the editor-api
// hot-reload path. Persisted JSON stays in ProjectDoc.logicBoards.
// ---------------------------------------------------------------------------

import type {
  LogicAction,
  LogicBoard,
  LogicBoardDoc,
  LogicCondition,
  LogicConditionNode,
  LogicEvent,
} from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import {
  boardLifecycleClass,
  usesTickFallback,
} from './trigger-execution'
import { luaString, luaValue, targetExpr, poolExpr, sensorSourceExpr } from './lua-helpers'
import { actionLua } from './action-emitter'

// Re-export helpers consumed by compiler.test.ts and any future callers.
export { luaString, luaValue, targetExpr } from './lua-helpers'

// ---- conditions -----------------------------------------------------------

function leafExpr(c: LogicCondition): string {
  switch (c.type) {
    case 'compareClass':
      return `collision.touchingClass(self, ${luaString(c.className)})`
    case 'compareVariable':
      return `(state.get(${luaString(c.key)}) ${c.operator} ${luaValue(c.value)})`
    case 'isKeyDown':
      return `input.isKeyDown(${luaString(c.keyCode)})`
    case 'hasTag':
      return `(function() for _,e in ipairs(object.findByTag(${luaString(c.tag)})) do if e==self then return true end end return false end)()`
    case 'compareDistance':
      return `(object.distance(self, ${targetExpr(c.target)}) ${c.operator} ${Number(c.value) || 0})`
    case 'isMouseOver': {
      const r2 = Math.pow(Number(c.radius) || 32, 2)
      return `(function() local mx,my=input.mousePosition() local p=entity.position(self) local dx=mx-p.x local dy=my-p.y return (dx*dx+dy*dy) <= ${r2} end)()`
    }
    case 'raycastHit': {
      const dx = Number(c.dirX) || 0
      const dy = Number(c.dirY) || 0
      const len = Number(c.length) || 0
      const classChk = c.className
        ? ` local ok=false for _,e in ipairs(pool.getAll(${luaString(c.className)})) do if e==r.entityId then ok=true break end end if not ok then return false end`
        : ''
      return `(function() local p=entity.position(self) local r=collision.raycast(p.x,p.y,p.x+(${dx})*(${len}),p.y+(${dy})*(${len})) if not r.hit then return false end${classChk} return true end)()`
    }
    case 'chance':
      return `(math.random(100) <= ${Number(c.percent) || 0})`
    case 'isSpaceFree':
      return `grid.isSpaceFree(${Number(c.x) || 0}, ${Number(c.y) || 0}, ${Number(c.w) || 32}, ${Number(c.h) || 32})`
    case 'compareHealth': {
      const target = targetExpr(c.target)
      const value = Number(c.value) || 0
      const field = c.field === 'max' ? '_m' : '_c'
      return `(function() local _c,_m=entity.health(${target}); if _c == nil then return false end return (${field} ${c.operator} ${value}) end)()`
    }
    case 'isPlatformerGrounded':
      return `platformer.isGrounded(${targetExpr(c.target)})`
  }
}

function nodeExpr(n: LogicConditionNode): string {
  if (n.kind === 'leaf') return leafExpr(n.condition)
  const joiner = n.operator === 'OR' ? ' or ' : ' and '
  const parts = n.statements.map(nodeExpr)
  if (parts.length === 0) return 'true'
  return '(' + parts.join(joiner) + ')'
}

/** Build the boolean guard for an event (flat list = AND; root = tree). */
export function conditionExpr(ev: LogicEvent): string {
  if (ev.onlyIfEnabled === false) return 'true'
  if (ev.conditionRoot) return nodeExpr(ev.conditionRoot)
  const list = ev.conditions ?? []
  if (list.length === 0) return 'true'
  return list.map((c) => leafExpr(c)).join(' and ')
}

// ---- code emission --------------------------------------------------------

const INDENT = '  '

/**
 * Emit actions in order; a `wait` splits the sequence — following actions (or
 * `wait.then`) run inside time.after so the game loop is not blocked.
 */
function emitActionSequence(actions: LogicAction[], indent: string): string[] {
  if (actions.length === 0) return []

  const lines: string[] = []
  let i = 0
  const batch: LogicAction[] = []
  while (i < actions.length && actions[i].type !== 'wait') {
    batch.push(actions[i++])
  }
  for (const a of batch) {
    const code = actionLua(a)
    if (!code.startsWith('--')) lines.push(indent + code)
  }

  if (i >= actions.length) return lines

  const w = actions[i]
  if (w.type !== 'wait') return lines

  const secs = Number(w.seconds) || 0
  const deferred = w.then?.length ? w.then : actions.slice(i + 1)
  const inner = emitActionSequence(deferred, indent + INDENT)

  lines.push(`${indent}time.after(${secs}, function()`)
  lines.push(...inner)
  lines.push(`${indent}end)`)
  return lines
}

function emitGuardedActions(ev: LogicEvent, baseIndent: string): string[] {
  const enableGuard = `_logic_on[${luaString(ev.id)}] ~= false`
  const condGuard = conditionExpr(ev)
  const guard =
    condGuard === 'true' ? enableGuard : `${enableGuard} and (${condGuard})`

  if (guard === 'true')
    return emitActionSequence(ev.actions, baseIndent)

  return [
    `${baseIndent}if ${guard} then`,
    ...emitActionSequence(ev.actions, baseIndent + INDENT),
    `${baseIndent}end`,
  ]
}

/**
 * Emit one event's body inside the per-entity loop. Returns Lua lines.
 * `timerKey` uniquely identifies an onTimer event for accumulator storage.
 */
function emitEventBody(ev: LogicEvent, board: LogicBoard, baseIndent: string): string[] {
  const lines: string[] = []
  const trig = ev.trigger

  // Every event is gated by its toggleLogicEvent enable flag (default on).
  const enableGuard = `_logic_on[${luaString(ev.id)}] ~= false`
  const condGuard = conditionExpr(ev)
  const guard =
    condGuard === 'true' ? enableGuard : `${enableGuard} and (${condGuard})`

  if (trig.type === 'onAnimationEnd') {
    // Registered in init via animation.onFinished — no tick body.
    return lines
  }

  if (trig.type === 'onDestroy') {
    const inner = baseIndent + INDENT
    lines.push(`${baseIndent}for _, de in ipairs(_destroy_events) do`)
    lines.push(`${baseIndent}${INDENT}if de.entityId == self and ${guard} then`)
    lines.push(...emitActionSequence(ev.actions, inner + INDENT))
    lines.push(`${baseIndent}${INDENT}end`)
    lines.push(`${baseIndent}end`)
    return lines
  }

  // onTriggerEnter / onTriggerExit: edges from sensor.poll() (indexed in _sensor_by_ent).
  if (trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit') {
    const inner = baseIndent + INDENT
    const tagGuard = trig.withClass
      ? `se.tag == ${luaString(trig.withClass)}`
      : 'true'
    const edgeGuard =
      trig.type === 'onTriggerEnter' ? 'se.enter' : '(not se.enter)'
    lines.push(
      `${baseIndent}for _, se in ipairs(_sensor_by_ent[self] or {}) do`,
    )
    lines.push(`${baseIndent}${INDENT}if ${tagGuard} and ${edgeGuard} and ${guard} then`)
    lines.push(`${baseIndent}${INDENT}${INDENT}other = se.otherId`)
    lines.push(...emitActionSequence(ev.actions, inner + INDENT))
    lines.push(`${baseIndent}${INDENT}end`)
    lines.push(`${baseIndent}end`)
    return lines
  }

  // onMouseInput: edge/level detection with per-event memory in _mb.
  if (trig.type === 'onMouseInput') {
    const btn = trig.button === 'right' ? 1 : 0
    const key = luaString(`${board.boardId}:${ev.id}`)
    const inner = baseIndent + INDENT
    lines.push(`${baseIndent}local _mbcur = input.mouseButtonDown(${btn})`)
    const fire =
      trig.eventType === 'pressed' ? `_mbcur and not _mb[${key}]`
      : trig.eventType === 'released' ? `(not _mbcur) and _mb[${key}]`
      : `_mbcur`
    lines.push(`${baseIndent}if (${fire}) and ${guard} then`)
    lines.push(...emitActionSequence(ev.actions, inner))
    lines.push(`${baseIndent}end`)
    lines.push(`${baseIndent}_mb[${key}] = _mbcur`)
    return lines
  }

  // Trigger-specific gating expression layered on top of the condition guard.
  let gate: string | null = null
  if (trig.type === 'onCollision') {
    gate = trig.withClass
      ? `collision.touchingClass(self, ${luaString(trig.withClass)})`
      : null
  } else if (trig.type === 'onInput') {
    const fn =
      trig.eventType === 'pressed'
        ? 'wasKeyPressed'
        : trig.eventType === 'released'
          ? 'wasKeyReleased'
          : 'isKeyDown'
    gate = `input.${fn}(${luaString(trig.keyCode)})`
  } else if (trig.type === 'onTimer') {
    const key = luaString(`${board.boardId}:${ev.id}`)
    const inner = baseIndent + INDENT
    lines.push(`${baseIndent}_logic_timers[${key}] = (_logic_timers[${key}] or 0) + dt`)
    lines.push(`${baseIndent}if _logic_timers[${key}] >= ${Number(trig.seconds) || 0} then`)
    if (trig.repeat) {
      lines.push(`${inner}_logic_timers[${key}] = 0`)
    }
    if (guard === 'true') {
      lines.push(...emitActionSequence(ev.actions, inner))
    } else {
      lines.push(`${inner}if ${guard} then`)
      lines.push(...emitActionSequence(ev.actions, inner + INDENT))
      lines.push(`${inner}end`)
    }
    lines.push(`${baseIndent}end`)
    return lines
  }

  const fullGuard =
    gate && guard !== 'true'
      ? `${gate} and (${guard})`
      : gate
        ? gate
        : guard

  if (fullGuard === 'true') {
    lines.push(...emitActionSequence(ev.actions, baseIndent))
  } else {
    lines.push(`${baseIndent}if ${fullGuard} then`)
    lines.push(...emitActionSequence(ev.actions, baseIndent + INDENT))
    lines.push(`${baseIndent}end`)
  }
  return lines
}

function emitEventRegistration(
  ev: LogicEvent,
  board: LogicBoard,
  project?: ProjectDoc | null,
): string[] | null {
  const trig = ev.trigger
  const I = INDENT
  const pool = poolExpr(board.target)
  const source = sensorSourceExpr(board.target)

  if (trig.type === 'onSpawn') {
    const cls = boardLifecycleClass(board, ev, project)
    if (!cls) return null
    return [
      `${I}lifecycle.onSpawn(${luaString(cls)}, function(entityId, tags)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onDestroy') {
    const cls = boardLifecycleClass(board, ev, project)
    if (!cls) return null
    return [
      `${I}lifecycle.onDestroy(${luaString(cls)}, function(entityId, tags)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onAnimationEnd') {
    const clip =
      trig.clipName && trig.clipName.length > 0
        ? luaString(trig.clipName)
        : luaString('*')
    return [
      `${I}animation.onFinished(${source}, ${clip}, function(entityId, clip)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onInput' && trig.eventType !== 'down') {
    const hook = trig.eventType === 'pressed' ? 'onPressed' : 'onReleased'
    return [
      `${I}input.${hook}(${luaString(trig.keyCode)}, function()`,
      `${I}${I}for _, self in ipairs(${pool}) do`,
      `${I}${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I + I),
      `${I}${I}end`,
      `${I}end)`,
    ]
  }

  if (trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit') {
    const hook = trig.type === 'onTriggerEnter' ? 'onEnter' : 'onExit'
    const target = trig.withClass ? luaString(trig.withClass) : luaString('*')
    return [
      `${I}sensor.${hook}(${source}, ${target}, function(entityId, otherId, tag)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = otherId`,
      ...emitGuardedActions(ev, I + I),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onTimer') {
    const fn = trig.repeat ? 'every' : 'after'
    return [
      `${I}time.${fn}(${Number(trig.seconds) || 0}, function()`,
      `${I}${I}for _, self in ipairs(${pool}) do`,
      `${I}${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I + I),
      `${I}${I}end`,
      `${I}end)`,
    ]
  }

  return null
}

function docUsesTickFallback(
  doc: LogicBoardDoc,
  type: string,
  project?: ProjectDoc | null,
): boolean {
  for (const board of doc) {
    for (const ev of board.events) {
      if (!ev.enabled) continue
      if (ev.trigger.type === type && usesTickFallback(ev, board, project))
        return true
    }
  }
  return false
}

const SENSOR_POLL_PREAMBLE = [
  `${INDENT}local _sensor_by_ent = {}`,
  `${INDENT}for _, se in ipairs(sensor.poll()) do`,
  `${INDENT}${INDENT}local eid = se.entityId`,
  `${INDENT}${INDENT}if not _sensor_by_ent[eid] then _sensor_by_ent[eid] = {} end`,
  `${INDENT}${INDENT}table.insert(_sensor_by_ent[eid], se)`,
  `${INDENT}end`,
]

const DESTROY_POLL_PREAMBLE = [
  `-- Fallback when onDestroy has no board class (prefer lifecycle.onDestroy in init)`,
  `${INDENT}local _destroy_events = lifecycle.pollDestroyed()`,
]

function emitBoard(
  board: LogicBoard,
  project?: ProjectDoc | null,
): { init: string[]; tick: string[] } {
  const enabled = board.events.filter((e) => e.enabled)
  const startEvents = enabled.filter((e) => e.trigger.type === 'onStart')
  const messageEvents = enabled.filter((e) => e.trigger.type === 'onMessage')
  const registeredEvents = enabled.filter((e) => {
    if (e.trigger.type === 'onStart' || e.trigger.type === 'onMessage') return false
    if (usesTickFallback(e, board, project)) return false
    return emitEventRegistration(e, board, project) !== null
  })
  const tickEvents = enabled.filter((e) => usesTickFallback(e, board, project))

  const pool = poolExpr(board.target)
  const init: string[] = []
  const tick: string[] = []

  if (startEvents.length > 0) {
    init.push(`${INDENT}for _, self in ipairs(${pool}) do`)
    for (const ev of startEvents) {
      init.push(...emitEventBody(ev, board, INDENT + INDENT))
    }
    init.push(`${INDENT}end`)
  }

  // onMessage → register an event.on listener once in init.
  for (const ev of messageEvents) {
    if (ev.trigger.type !== 'onMessage') continue
    const I = INDENT
    init.push(`${I}event.on(${luaString(ev.trigger.messageName)}, function()`)
    init.push(`${I}${I}for _, self in ipairs(${pool}) do`)
    init.push(`${I}${I}${I}local other = nil`)
    init.push(...emitEventBody(ev, board, I + I + I))
    init.push(`${I}${I}end`)
    init.push(`${I}end)`)
  }

  for (const ev of registeredEvents) {
    const registration = emitEventRegistration(ev, board, project)
    if (registration) init.push(...registration)
  }

  if (tickEvents.length > 0) {
    tick.push(`${INDENT}for _, self in ipairs(${pool}) do`)
    tick.push(`${INDENT}${INDENT}local other = nil`)
    for (const ev of tickEvents) {
      tick.push(...emitEventBody(ev, board, INDENT + INDENT))
    }
    tick.push(`${INDENT}end`)
  }

  return { init, tick }
}

// ---- public entry ---------------------------------------------------------

/**
 * Compile a full LogicBoardDoc into one Lua source string with a single
 * `tick(dt)` entry point (plus a one-shot init guard).
 */
export function compileLogicBoard(
  doc: LogicBoardDoc,
  project?: ProjectDoc | null,
): string {
  const header = [
    '-- AUTO-GENERATED by ArtCade Logic Board compiler.',
    '-- Do not edit by hand: changes will be overwritten on next save.',
    '',
    'local _init_done = false',
    'local _logic_timers = {}   -- polling timers',
    'local _logic_on = {}       -- event enable flags',
    'local _mb = {}             -- mouse button edge state',
    'local _logic_movement_known = {}',
    'local _logic_movement_frame = nil',
    '',
    'local function _logic_add_movement(entityId, x, y)',
    `${INDENT}if _logic_movement_frame == nil or entityId == nil then return end`,
    `${INDENT}local m = _logic_movement_frame[entityId]`,
    `${INDENT}if not m then`,
    `${INDENT}${INDENT}m = { x = 0, y = 0 }`,
    `${INDENT}${INDENT}_logic_movement_frame[entityId] = m`,
    `${INDENT}end`,
    `${INDENT}m.x = m.x + x`,
    `${INDENT}m.y = m.y + y`,
    'end',
    '',
    'local function _logic_flush_movement()',
    `${INDENT}if _logic_movement_frame == nil then return end`,
    `${INDENT}for entityId, m in pairs(_logic_movement_frame) do`,
    `${INDENT}${INDENT}if m.x ~= 0 or m.y ~= 0 then`,
    `${INDENT}${INDENT}${INDENT}movement.setIntent(entityId, m.x, m.y)`,
    `${INDENT}${INDENT}else`,
    `${INDENT}${INDENT}${INDENT}movement.clearIntent(entityId)`,
    `${INDENT}${INDENT}end`,
    `${INDENT}${INDENT}_logic_movement_known[entityId] = true`,
    `${INDENT}end`,
    `${INDENT}for entityId, _ in pairs(_logic_movement_known) do`,
    `${INDENT}${INDENT}if _logic_movement_frame[entityId] == nil then`,
    `${INDENT}${INDENT}${INDENT}movement.clearIntent(entityId)`,
    `${INDENT}${INDENT}${INDENT}_logic_movement_known[entityId] = nil`,
    `${INDENT}${INDENT}end`,
    `${INDENT}end`,
    `${INDENT}_logic_movement_frame = nil`,
    'end',
    '',
    "-- Keep the project's own tick(dt) and layer Logic Board behavior on top.",
    '-- Hot reload replaces the global tick(), so the original project tick is',
    '-- captured once and reused across repeated Apply operations.',
    'if __artcade_project_tick == nil and not __artcade_board_active then',
    `${INDENT}__artcade_project_tick = rawget(_G, "tick")`,
    'end',
    '__artcade_board_active = true',
    '',
  ]

  const initBlocks: string[] = []
  const tickBlocks: string[] = []
  for (const board of doc) {
    const { init, tick } = emitBoard(board, project)
    if (init.length) {
      initBlocks.push(`${INDENT}-- board: ${board.boardId}`, ...init)
    }
    if (tick.length) {
      tickBlocks.push(`${INDENT}-- board: ${board.boardId}`, ...tick)
    }
  }
  const useSensor = docUsesTickFallback(doc, 'onTriggerEnter', project) ||
    docUsesTickFallback(doc, 'onTriggerExit', project)
  const useDestroy = docUsesTickFallback(doc, 'onDestroy', project)
  const hasPollingLogic =
    tickBlocks.length > 0 || useSensor || useDestroy

  const body = [
    'local function _logic_init()',
    ...initBlocks,
    'end',
    '',
    `__artcade_requires_tick = ${hasPollingLogic ? 'true' : 'false'} or (__artcade_project_tick ~= nil)`,
    'if not __artcade_requires_tick and not _init_done then',
    `${INDENT}_logic_init()`,
    `${INDENT}_init_done = true`,
    'end',
    '',
    'function tick(dt)',
    `${INDENT}-- Run the project's own game logic first.`,
    `${INDENT}if __artcade_project_tick then __artcade_project_tick(dt) end`,
    `${INDENT}if not _init_done then`,
    `${INDENT}${INDENT}_logic_init()`,
    `${INDENT}${INDENT}_init_done = true`,
    `${INDENT}end`,
    `${INDENT}_logic_movement_frame = {}`,
    ...(useSensor ? SENSOR_POLL_PREAMBLE : []),
    ...(useDestroy ? DESTROY_POLL_PREAMBLE : []),
    ...tickBlocks,
    `${INDENT}_logic_flush_movement()`,
    'end',
    '',
  ]

  return header.concat(body).join('\n')
}
