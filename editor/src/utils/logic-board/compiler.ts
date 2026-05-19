// ---------------------------------------------------------------------------
// Logic Board compiler — turns a LogicBoardDoc into a single Lua source string.
//
// Design constraints (verified against the real runtime):
//   • The C++ runtime only ever calls the global `tick(dt)` (lua-host.cpp).
//     There is NO push-based onCollision/onInput callback — everything is
//     polled inside tick(). onStart runs once via an init guard.
//   • The generated Lua uses the real dot-notation API prelude exposed by
//     runtime-cpp/src/modules/game-api/src/*.cpp:
//       state.get/set/add, entity.setPosition/setVelocity/destroy,
//       audio.playSound/playMusic/stopAll, object.spawn,
//       collision.touchingClass, input.isKeyDown/wasKeyPressed/wasKeyReleased,
//       pool.getAll, debug.log
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
  TargetSelector,
} from '../../types/logic-board'

// ---- literal helpers ------------------------------------------------------

/** Escape a JS string into a safe double-quoted Lua string literal. */
export function luaString(s: string): string {
  return (
    '"' +
    s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    '"'
  )
}

/** Render a JS value (string/number/boolean) as a Lua literal. */
export function luaValue(v: number | string | boolean): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return luaString(v)
}

// ---- target selectors -----------------------------------------------------

/**
 * Resolve a TargetSelector to a Lua expression yielding an entity id.
 * `self` / `other` are loop-local locals emitted by the trigger scaffolding.
 */
export function targetExpr(t: TargetSelector): string {
  if (t === 'self') return 'self'
  if (t === 'other') return 'other'
  if ('entityId' in t) return String(t.entityId)
  // class pool — MVP resolves to the first match (Lua arrays are 1-indexed)
  return `(pool.getAll(${luaString(t.className)})[1])`
}

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
  if (ev.conditionRoot) return nodeExpr(ev.conditionRoot)
  const list = ev.conditions ?? []
  if (list.length === 0) return 'true'
  return list.map((c) => leafExpr(c)).join(' and ')
}

// ---- actions --------------------------------------------------------------

function actionLua(a: LogicAction): string {
  switch (a.type) {
    case 'setVariable':
      return `state.set(${luaString(a.key)}, ${luaValue(a.value)})`
    case 'addVariable':
      return `state.add(${luaString(a.key)}, ${Number(a.amount) || 0})`
    case 'setPosition':
      return `entity.setPosition(${targetExpr(a.target)}, ${Number(a.x) || 0}, ${Number(a.y) || 0})`
    case 'setVelocity':
      return `entity.setVelocity(${targetExpr(a.target)}, ${Number(a.vx) || 0}, ${Number(a.vy) || 0})`
    case 'playSound':
      return `audio.playSound(${luaString(a.path)}, ${a.volume ?? 1}, ${a.pitch ?? 1})`
    case 'playMusic':
      return `audio.playMusic(${luaString(a.path)}, ${a.loop !== false})`
    case 'stopAllAudio':
      return `audio.stopAll()`
    case 'destroyEntity':
      return `entity.destroy(${targetExpr(a.target)})`
    case 'spawnEntity':
      return `object.spawn(${luaString(a.className)}, ${Number(a.x) || 0}, ${Number(a.y) || 0})`
    case 'setGlobalState':
      return `state.set(${luaString(a.key)}, ${luaValue(a.value)})`
    case 'emitEvent':
      return a.payloadKey
        ? `event.emit(${luaString(a.name)}, { [${luaString(a.payloadKey)}] = ${luaValue(a.payloadValue ?? '')} })`
        : `event.emit(${luaString(a.name)})`
    case 'toggleLogicEvent':
      return `_logic_on[${luaString(a.eventId)}] = ${a.enabled ? 'true' : 'false'}`
    case 'debugLog':
      return `debug.log(${luaString(a.message)})`
  }
}

// ---- code emission --------------------------------------------------------

const INDENT = '  '

function emitActions(actions: LogicAction[], indent: string): string[] {
  return actions.map((a) => indent + actionLua(a))
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
    lines.push(...emitActions(ev.actions, inner))
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
    lines.push(`${baseIndent}_timers[${key}] = (_timers[${key}] or 0) + dt`)
    lines.push(`${baseIndent}if _timers[${key}] >= ${Number(trig.seconds) || 0} then`)
    if (trig.repeat) {
      lines.push(`${inner}_timers[${key}] = 0`)
    }
    if (guard === 'true') {
      lines.push(...emitActions(ev.actions, inner))
    } else {
      lines.push(`${inner}if ${guard} then`)
      lines.push(...emitActions(ev.actions, inner + INDENT))
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
    lines.push(...emitActions(ev.actions, baseIndent))
  } else {
    lines.push(`${baseIndent}if ${fullGuard} then`)
    lines.push(...emitActions(ev.actions, baseIndent + INDENT))
    lines.push(`${baseIndent}end`)
  }
  return lines
}

function poolExpr(board: LogicBoard): string {
  if (board.target.type === 'entity_class' && board.target.className) {
    return `pool.getAll(${luaString(board.target.className)})`
  }
  if (board.target.type === 'entity_id' && board.target.entityId != null) {
    return `{ ${board.target.entityId} }`
  }
  return `{}`
}

function emitBoard(board: LogicBoard): { init: string[]; tick: string[] } {
  const enabled = board.events.filter((e) => e.enabled)
  const startEvents = enabled.filter((e) => e.trigger.type === 'onStart')
  const messageEvents = enabled.filter((e) => e.trigger.type === 'onMessage')
  const tickEvents = enabled.filter(
    (e) => e.trigger.type !== 'onStart' && e.trigger.type !== 'onMessage',
  )

  const pool = poolExpr(board)
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
export function compileLogicBoard(doc: LogicBoardDoc): string {
  const header = [
    '-- AUTO-GENERATED by ArtCade Logic Board compiler.',
    '-- Do not edit by hand: changes will be overwritten on next save.',
    '',
    'local _init_done = false',
    'local _timers = {}',
    'local _logic_on = {}   -- toggleLogicEvent: false = disabled',
    'local _mb = {}         -- onMouseInput edge memory',
    '',
    "-- Preserve the project's own tick(dt) so Logic Board logic is ADDITIVE,",
    '-- not a replacement. Hot-reload redefines the global tick(); without this',
    "-- capture the running game's script (movement, rendering, physics) would",
    '-- be wiped and the canvas would appear frozen after Apply & Hot-Reload.',
    '-- Captured once and kept pristine across repeated Applies.',
    'if __artcade_project_tick == nil and not __artcade_board_active then',
    `${INDENT}__artcade_project_tick = rawget(_G, "tick")`,
    'end',
    '__artcade_board_active = true',
    '',
  ]

  const initBlocks: string[] = []
  const tickBlocks: string[] = []

  for (const board of doc) {
    const { init, tick } = emitBoard(board)
    if (init.length) {
      initBlocks.push(`${INDENT}-- board: ${board.boardId}`, ...init)
    }
    if (tick.length) {
      tickBlocks.push(`${INDENT}-- board: ${board.boardId}`, ...tick)
    }
  }

  const body = [
    'local function _logic_init()',
    ...initBlocks,
    'end',
    '',
    'function tick(dt)',
    `${INDENT}-- run the project's own game logic first (movement, render, physics)`,
    `${INDENT}if __artcade_project_tick then __artcade_project_tick(dt) end`,
    `${INDENT}if not _init_done then`,
    `${INDENT}${INDENT}_logic_init()`,
    `${INDENT}${INDENT}_init_done = true`,
    `${INDENT}end`,
    ...tickBlocks,
    'end',
    '',
  ]

  return header.concat(body).join('\n')
}
