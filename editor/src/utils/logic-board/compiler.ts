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
    case 'isSpaceFree':
      return `grid.isSpaceFree(${Number(c.x) || 0}, ${Number(c.y) || 0}, ${Number(c.w) || 32}, ${Number(c.h) || 32})`
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
    case 'spawnEntity': {
      const cls = luaString(a.className)
      const spawn = a.imagePoint
        ? `(function() local _px, _py = entity.imagePoint(self, ${luaString(a.imagePoint)}); return object.spawn(${cls}, _px, _py) end)()`
        : `object.spawn(${cls}, ${Number(a.x) || 0}, ${Number(a.y) || 0})`
      if (!a.inheritFlip) return spawn
      return `(function() local _nid = ${spawn}; local _sx, _sy = entity.scale(self); local _fx = (_sx < 0) and -1 or 1; entity.setScale(_nid, _fx * math.abs(_sx), math.abs(_sy)); return _nid end)()`
    }
    case 'moveInDirection': {
      const t = targetExpr(a.target)
      const s = Number(a.speed) || 0
      switch (a.direction) {
        case 'up':
          return `entity.setVelocity(${t}, 0, ${-s})`
        case 'down':
          return `entity.setVelocity(${t}, 0, ${s})`
        case 'left':
          return `entity.setVelocity(${t}, ${-s}, 0)`
        case 'right':
          return `entity.setVelocity(${t}, ${s}, 0)`
        case 'forward':
          return `(function() local _sx, _ = entity.scale(${t}); local _d = (_sx < 0) and -1 or 1; entity.setVelocity(${t}, _d * ${s}, 0) end)()`
        case 'backward':
          return `(function() local _sx, _ = entity.scale(${t}); local _d = (_sx < 0) and -1 or 1; entity.setVelocity(${t}, -_d * ${s}, 0) end)()`
      }
    }
    case 'setGlobalState':
      return `state.set(${luaString(a.key)}, ${luaValue(a.value)})`
    case 'emitEvent':
      return a.payloadKey
        ? `event.emit(${luaString(a.name)}, { [${luaString(a.payloadKey)}] = ${luaValue(a.payloadValue ?? '')} })`
        : `event.emit(${luaString(a.name)})`
    case 'toggleLogicEvent':
      return `_logic_on[${luaString(a.eventId)}] = ${a.enabled ? 'true' : 'false'}`
    case 'applyImpulse':
      return `physics.applyImpulse(${targetExpr(a.target)}, ${Number(a.ix) || 0}, ${Number(a.iy) || 0})`
    case 'applyForce':
      return `physics.applyForce(${targetExpr(a.target)}, ${Number(a.fx) || 0}, ${Number(a.fy) || 0})`
    case 'setRotation':
      return `entity.setRotation(${targetExpr(a.target)}, ${Number(a.angle) || 0})`
    case 'setScale':
      return `entity.setScale(${targetExpr(a.target)}, ${Number(a.scaleX) || 0}, ${Number(a.scaleY) || 0})`
    case 'setVisible':
      return `entity.setVisible(${targetExpr(a.target)}, ${a.visible ? 'true' : 'false'})`
    case 'setColorTint': {
      const m = /^#?([0-9a-fA-F]{6})$/.exec(a.hexColor || '')
      const hex = m ? m[1] : 'ffffff'
      const r = (parseInt(hex.slice(0, 2), 16) / 255).toFixed(4)
      const g = (parseInt(hex.slice(2, 4), 16) / 255).toFixed(4)
      const b = (parseInt(hex.slice(4, 6), 16) / 255).toFixed(4)
      const al = a.alpha == null ? 1 : Number(a.alpha)
      return `entity.setTint(${targetExpr(a.target)}, ${r}, ${g}, ${b}, ${al})`
    }
    case 'loadScene':
      return a.fadeSeconds != null && a.fadeSeconds > 0
        ? `scene.load(${luaString(a.sceneName)}, ${Number(a.fadeSeconds)})`
        : `scene.load(${luaString(a.sceneName)})`
    case 'restartScene':
      return `scene.restart()`
    case 'setCameraTarget':
      return `camera.centerOn(${targetExpr(a.target)})`
    case 'debugLog':
      return `debug.log(${luaString(a.message)})`
    case 'wait':
      return `-- wait handled by emitActionSequence`
    case 'moveByOffset':
      return `grid.moveByOffset(${targetExpr(a.target)}, ${Number(a.dx) || 0}, ${Number(a.dy) || 0})`
    case 'snapToGrid':
      return `grid.snapToGrid(${targetExpr(a.target)}, ${Number(a.cellSize) || 32})`
    case 'setEntityShader':
      return `shaders.setEntity(${targetExpr(a.target)}, ${luaString(a.shader)})`
    case 'setScreenShader':
      return `shaders.setScreen(${luaString(a.shader)})`
  }
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
    const inner = baseIndent + INDENT
    const clipGuard =
      trig.clipName && trig.clipName.length > 0
        ? `af.clip == ${luaString(trig.clipName)}`
        : 'true'
    lines.push(`${baseIndent}for _, af in ipairs(_anim_finished[self] or {}) do`)
    lines.push(`${baseIndent}${INDENT}if ${clipGuard} and ${guard} then`)
    lines.push(...emitActionSequence(ev.actions, inner + INDENT))
    lines.push(`${baseIndent}${INDENT}end`)
    lines.push(`${baseIndent}end`)
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

function boardLifecycleClass(board: LogicBoard, ev: LogicEvent): string | null {
  if (ev.trigger.type === 'onSpawn' && ev.trigger.className)
    return ev.trigger.className
  if (board.target.type === 'entity_class' && board.target.className)
    return board.target.className
  return null
}

function sensorSourceExpr(board: LogicBoard): string {
  if (board.target.type === 'entity_class' && board.target.className)
    return luaString(board.target.className)
  if (board.target.type === 'entity_id' && board.target.entityId != null)
    return String(board.target.entityId)
  return luaString('*')
}

function emitEventRegistration(ev: LogicEvent, board: LogicBoard): string[] | null {
  const trig = ev.trigger
  const I = INDENT
  const pool = poolExpr(board)

  if (trig.type === 'onSpawn') {
    const cls = boardLifecycleClass(board, ev)
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
    const cls = boardLifecycleClass(board, ev)
    if (!cls) return null
    return [
      `${I}lifecycle.onDestroy(${luaString(cls)}, function(entityId, tags)`,
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
    const source = sensorSourceExpr(board)
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

function usesTickFallback(ev: LogicEvent, board: LogicBoard): boolean {
  if (ev.trigger.type === 'onStart' || ev.trigger.type === 'onMessage') return false
  if (ev.trigger.type === 'onInput') return ev.trigger.eventType === 'down'
  if (ev.trigger.type === 'onTimer') return false
  if (ev.trigger.type === 'onTriggerEnter' || ev.trigger.type === 'onTriggerExit') return false
  if (ev.trigger.type === 'onSpawn') return false
  if (ev.trigger.type === 'onDestroy') return emitEventRegistration(ev, board) === null
  return true
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

function docUsesTriggerType(doc: LogicBoardDoc, types: Set<string>): boolean {
  for (const board of doc) {
    for (const ev of board.events) {
      if (!ev.enabled) continue
      if (types.has(ev.trigger.type)) return true
    }
  }
  return false
}

function docUsesTickFallback(doc: LogicBoardDoc, type: string): boolean {
  for (const board of doc) {
    for (const ev of board.events) {
      if (!ev.enabled) continue
      if (ev.trigger.type === type && usesTickFallback(ev, board)) return true
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

const ANIM_POLL_PREAMBLE = [
  `${INDENT}local _anim_finished = {}`,
  `${INDENT}for _, af in ipairs(animation.pollFinished()) do`,
  `${INDENT}${INDENT}local eid = af.entityId`,
  `${INDENT}${INDENT}if not _anim_finished[eid] then _anim_finished[eid] = {} end`,
  `${INDENT}${INDENT}table.insert(_anim_finished[eid], af)`,
  `${INDENT}end`,
]

const DESTROY_POLL_PREAMBLE = [
  `${INDENT}local _destroy_events = lifecycle.pollDestroyed()`,
]

function emitBoard(board: LogicBoard): { init: string[]; tick: string[] } {
  const enabled = board.events.filter((e) => e.enabled)
  const startEvents = enabled.filter((e) => e.trigger.type === 'onStart')
  const messageEvents = enabled.filter((e) => e.trigger.type === 'onMessage')
  const registeredEvents = enabled.filter((e) => {
    if (e.trigger.type === 'onStart' || e.trigger.type === 'onMessage') return false
    return emitEventRegistration(e, board) !== null
  })
  const tickEvents = enabled.filter(
    (e) => usesTickFallback(e, board),
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

  for (const ev of registeredEvents) {
    const registration = emitEventRegistration(ev, board)
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
export function compileLogicBoard(doc: LogicBoardDoc): string {
  const header = [
    '-- AUTO-GENERATED by ArtCade Logic Board compiler.',
    '-- Do not edit by hand: changes will be overwritten on next save.',
    '',
    'local _init_done = false',
    'local _logic_timers = {}   -- legacy polling accumulators',
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
  const useSensor = docUsesTickFallback(doc, 'onTriggerEnter') ||
    docUsesTickFallback(doc, 'onTriggerExit')
  const useAnim = docUsesTriggerType(doc, new Set(['onAnimationEnd']))
  const useDestroy = docUsesTickFallback(doc, 'onDestroy')
  const hasPollingLogic =
    tickBlocks.length > 0 || useSensor || useAnim || useDestroy

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
    `${INDENT}-- run the project's own game logic first (movement, render, physics)`,
    `${INDENT}if __artcade_project_tick then __artcade_project_tick(dt) end`,
    `${INDENT}if not _init_done then`,
    `${INDENT}${INDENT}_logic_init()`,
    `${INDENT}${INDENT}_init_done = true`,
    `${INDENT}end`,
    ...(useSensor ? SENSOR_POLL_PREAMBLE : []),
    ...(useAnim ? ANIM_POLL_PREAMBLE : []),
    ...(useDestroy ? DESTROY_POLL_PREAMBLE : []),
    ...tickBlocks,
    'end',
    '',
  ]

  return header.concat(body).join('\n')
}
