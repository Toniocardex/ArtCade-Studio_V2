// ---------------------------------------------------------------------------
// Action emitter — maps each LogicAction to a single Lua statement string.
// Add new action types here; everything else lives in compiler.ts.
// ---------------------------------------------------------------------------

import type { LogicAction } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { luaPointerWorldPairStmt, luaString, luaValue, targetExpr } from './lua-helpers'
import { ruleKeyExpr } from './event-slugs'

/** Coerce to a finite number, falling back to `fallback` for NaN/Infinity. */
function finite(n: unknown, fallback = 0): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : fallback
}

/** Camera shake intensity 0–1 (Logic Board trauma field). */
function traumaIntensity(n: unknown): number {
  const v = finite(n, 0.35)
  return Math.min(1, Math.max(0, v))
}

/** Shake fade-out duration in seconds (Logic Board durationSeconds). */
function shakeDurationSeconds(n: unknown): number {
  const v = finite(n, 0.5)
  return Math.min(10, Math.max(0.05, v))
}

/**
 * Sentinel returned by actionLua for `wait` so emitActionSequence can detect
 * and drop it before splicing the deferred tail into `time.after`. Kept as a
 * shared constant to avoid the magic-string drift between modules.
 */
export const WAIT_SENTINEL_PREFIX = '-- wait handled'

/** Sentinel for `repeatTimes`; handled in emit-action-sequence.ts. */
export const REPEAT_TIMES_SENTINEL_PREFIX = '-- repeatTimes handled'

export interface ActionEmitCtx {
  /** id → RULE-table slug; used to render `_logic_on[RULE.<slug>]` keys. */
  eventSlugs?: Map<string, string>
  project?: ProjectDoc | null
}

/**
 * Emit a single Lua statement for a Logic Board action. ALWAYS returns a
 * string — when the action shape is unknown (stale `direction` enum from
 * an older project.json, future action type loaded by an older editor,
 * malformed data) we emit a `-- TODO unknown ...` comment instead of
 * letting the function fall off the end with implicit `undefined`. That
 * keeps the compiled Lua valid and surfaces the issue to the user via the
 * generated source preview, rather than silently dropping behaviours.
 */
function unknownActionComment(a: LogicAction, detail?: string): string {
  const type = (a as { type?: unknown }).type ?? 'unknown'
  const tail = detail ? ` (${detail})` : ''
  return `-- TODO ArtCade: unknown action ${luaString(String(type))}${tail}`
}

export function actionLua(a: LogicAction, ctx: ActionEmitCtx = {}): string {
  const project = ctx.project
  const target = (sel: Parameters<typeof targetExpr>[0]) => targetExpr(sel, project)
  switch (a.type) {
    case 'setVariable':
      return `state.set(${luaString(a.key)}, ${luaValue(a.value)})`
    case 'addVariable':
      return `state.add(${luaString(a.key)}, ${Number(a.amount) || 0})`
    case 'setPosition':
      return `entity.setPosition(${target(a.target)}, ${Number(a.x) || 0}, ${Number(a.y) || 0})`
    case 'setVelocity':
      return `entity.setVelocity(${target(a.target)}, ${Number(a.vx) || 0}, ${Number(a.vy) || 0})`
    case 'playSound':
      return `audio.playSound(${luaString(a.path)}, ${a.volume ?? 1}, ${a.pitch ?? 1})`
    case 'playMusic':
      return `audio.playMusic(${luaString(a.path)}, ${a.loop !== false})`
    case 'stopAllAudio':
      return `audio.stopAll()`
    case 'stopMusic':
      return `audio.stopMusic()`
    case 'pauseMusic':
      return `audio.pauseMusic()`
    case 'resumeMusic':
      return `audio.resumeMusic()`
    case 'destroyEntity':
      return `entity.destroy(${target(a.target)})`
    case 'clickToDestroy':
      return 'entity.destroy(self)'
    case 'spawnEntity': {
      const cls = luaString(a.className)
      const spawn = a.imagePoint
        ? `(function() local _px, _py = entity.imagePoint(self, ${luaString(a.imagePoint)}); return object.spawn(${cls}, _px, _py) end)()`
        : `object.spawn(${cls}, ${Number(a.x) || 0}, ${Number(a.y) || 0})`
      if (!a.inheritFlip) return spawn
      return `(function() local _nid = ${spawn}; local _sx, _sy = entity.scale(self); local _fx = (_sx < 0) and -1 or 1; entity.setScale(_nid, _fx * math.abs(_sx), math.abs(_sy)); return _nid end)()`
    }
    case 'spawnEntityAtPointer': {
      const cls = luaString(a.className)
      return `(function() ${luaPointerWorldPairStmt()}; return object.spawn(${cls}, _mx, _my) end)()`
    }
    case 'moveInDirection': {
      const t = target(a.target)
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
      return unknownActionComment(a,
        `direction=${String((a as { direction?: unknown }).direction)}`)
    }
    case 'controllerMovement': {
      const t = target(a.target)
      switch (a.direction) {
        case 'left':
          return `_logic_add_movement(${t}, -1, 0)`
        case 'right':
          return `_logic_add_movement(${t}, 1, 0)`
        case 'up':
          return `_logic_add_movement(${t}, 0, -1)`
        case 'down':
          return `_logic_add_movement(${t}, 0, 1)`
      }
      return unknownActionComment(a,
        `direction=${String((a as { direction?: unknown }).direction)}`)
    }
    case 'moveController': {
      const t = target(a.target)
      switch (a.direction) {
        case 'left':
          return `movement.setIntent(${t}, -1, 0)`
        case 'right':
          return `movement.setIntent(${t}, 1, 0)`
        case 'up':
          return `movement.setIntent(${t}, 0, -1)`
        case 'down':
          return `movement.setIntent(${t}, 0, 1)`
        case 'stop':
          return `movement.clearIntent(${t})`
      }
      return unknownActionComment(a,
        `direction=${String((a as { direction?: unknown }).direction)}`)
    }
    case 'clearMovementIntent':
      return `movement.clearIntent(${target(a.target)})`
    case 'requestPlatformerJump':
      return `platformer.requestJump(${target(a.target)})`
    case 'damageEntity':
      return `entity.damage(${target(a.target)}, ${Number(a.amount) || 0})`
    case 'healEntity': {
      const t = target(a.target)
      const amount = Number(a.amount) || 0
      return `(function() local _c,_m=entity.health(${t}); if _c ~= nil then entity.setHealth(${t}, math.min(_m, _c + ${amount}), _m) end end)()`
    }
    case 'setEntityHealth':
      return a.maxHp != null
        ? `entity.setHealth(${target(a.target)}, ${Number(a.currentHp) || 0}, ${Number(a.maxHp) || 0})`
        : `entity.setHealth(${target(a.target)}, ${Number(a.currentHp) || 0})`
    case 'setLinearMoverDirection':
      return `linearMover.setDirection(${target(a.target)}, ${Number(a.directionX) || 0}, ${Number(a.directionY) || 0})`
    case 'setLinearMoverSpeed':
      return `linearMover.setSpeed(${target(a.target)}, ${Number(a.speed) || 0})`
    case 'pauseLinearMover':
      return `linearMover.pause(${target(a.target)})`
    case 'resumeLinearMover':
      return `linearMover.resume(${target(a.target)})`
    case 'setMagnetEnabled':
      return `magnet.setEnabled(${target(a.target)}, ${a.enabled ? 'true' : 'false'})`
    case 'setMagnetTargetTag':
      return `magnet.setTargetTag(${target(a.target)}, ${luaString(a.tag)})`
    case 'setHordeTargetClass':
      return `horde.setTargetClass(${target(a.target)}, ${luaString(a.className)})`
    case 'setHordeWeights':
      return `horde.setWeights(${target(a.target)}, ${Number(a.chaseWeight) || 0}, ${Number(a.separationWeight) || 0})`
    case 'setAutoDestroyLifespan':
      return `autoDestroy.setLifespan(${target(a.target)}, ${Number(a.lifespan) || 0})`
    case 'cancelAutoDestroy':
      return `autoDestroy.cancel(${target(a.target)})`
    case 'emitEvent':
      return a.payloadKey
        ? `event.emit(${luaString(a.name)}, { [${luaString(a.payloadKey)}] = ${luaValue(a.payloadValue ?? '')} })`
        : `event.emit(${luaString(a.name)})`
    case 'startDialog':
      return `dialog.start(${target(a.target)}, ${luaString(a.dialogId)})`
    case 'toggleLogicEvent':
      return `_logic_on[${ruleKeyExpr(a.eventId, ctx.eventSlugs)}] = ${a.enabled ? 'true' : 'false'}`
    case 'applyImpulse':
      return `physics.applyImpulse(${target(a.target)}, ${Number(a.ix) || 0}, ${Number(a.iy) || 0})`
    case 'applyForce':
      return `physics.applyForce(${target(a.target)}, ${Number(a.fx) || 0}, ${Number(a.fy) || 0})`
    case 'setRotation':
      return `entity.setRotation(${target(a.target)}, ${Number(a.angle) || 0})`
    case 'setScale':
      return `entity.setScale(${target(a.target)}, ${Number(a.scaleX) || 0}, ${Number(a.scaleY) || 0})`
    case 'playAnimation':
      return `animation.play(${target(a.target)}, ${luaString(a.clipName)})`
    case 'setFlip': {
      const t = target(a.target)
      const fx = a.flipX ? 'true' : 'false'
      const fy = a.flipY != null ? (a.flipY ? 'true' : 'false') : 'nil'
      return `entity.setFlip(${t}, ${fx}, ${fy})`
    }
    case 'setVisible':
      return `entity.setVisible(${target(a.target)}, ${a.visible ? 'true' : 'false'})`
    case 'setColorTint': {
      const m = /^#?([0-9a-fA-F]{6})$/.exec(a.hexColor || '')
      const hex = m ? m[1] : 'ffffff'
      const r = (parseInt(hex.slice(0, 2), 16) / 255).toFixed(4)
      const g = (parseInt(hex.slice(2, 4), 16) / 255).toFixed(4)
      const b = (parseInt(hex.slice(4, 6), 16) / 255).toFixed(4)
      const al = a.alpha == null ? 1 : finite(a.alpha, 1)
      return `entity.setTint(${target(a.target)}, ${r}, ${g}, ${b}, ${al})`
    }
    case 'loadScene': {
      const fade = finite(a.fadeSeconds)
      return fade > 0
        ? `scene.load(${luaString(a.sceneName)}, ${fade})`
        : `scene.load(${luaString(a.sceneName)})`
    }
    case 'restartScene':
      return `scene.restart()`
    case 'setCameraTarget':
      return `camera.centerOn(${target(a.target)})`
    case 'cameraShake':
      return `camera.shake(${traumaIntensity(a.trauma)}, ${shakeDurationSeconds(a.durationSeconds)})`
    case 'debugLog':
      return `debug.log(${luaString(a.message)})`
    case 'wait':
      return `${WAIT_SENTINEL_PREFIX} by emitActionSequence`
    case 'repeatTimes':
      return `${REPEAT_TIMES_SENTINEL_PREFIX} by emitActionSequence`
    case 'moveByOffset':
      return `grid.moveByOffset(${target(a.target)}, ${Number(a.dx) || 0}, ${Number(a.dy) || 0})`
    case 'snapToGrid':
      return `grid.snapToGrid(${target(a.target)}, ${Number(a.cellSize) || 32})`
    case 'setEntityShader':
      return `shaders.setEntity(${target(a.target)}, ${luaString(a.shader)})`
    case 'setScreenShader':
      return `shaders.setScreen(${luaString(a.shader)})`
  }
  // Unknown action type (stale project.json, older runtime than the
  // editor expected, malformed payload). Emit a parseable Lua comment
  // so emitActionSequence drops it cleanly instead of compiling
  // undefined into the output and crashing the Lua preview.
  return unknownActionComment(a)
}
