// ---------------------------------------------------------------------------
// Action emitter — maps each LogicAction to a single Lua statement string.
// Add new action types here; everything else lives in compiler.ts.
// ---------------------------------------------------------------------------

import type { LogicAction, LogicValue } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { luaPointerWorldPairStmt, luaString, luaValue, targetExpr } from './lua-helpers'
import { ruleKeyExpr } from './event-slugs'
import { numberSourceExpr, valueSourceExpr } from './value-source'

/** Coerce to a finite number, falling back to `fallback` for NaN/Infinity. */
function finite(n: unknown, fallback = 0): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : fallback
}

/**
 * Wrap a spawn expression (which evaluates to the new entity id) so it also
 * applies a launch velocity when the action provides one. Enables the classic
 * "fire a projectile" pattern without a second rule on the spawned entity.
 */
function spawnWithVelocity(
  spawnExpr: string,
  a: { velocityX?: LogicValue; velocityY?: LogicValue },
  project?: ProjectDoc | null,
): string {
  if (a.velocityX == null && a.velocityY == null) return spawnExpr
  const vx = numberSourceExpr(a.velocityX ?? 0, project)
  const vy = numberSourceExpr(a.velocityY ?? 0, project)
  return `(function() local _nid = ${spawnExpr}; if _nid then entity.setVelocity(_nid, ${vx}, ${vy}) end; return _nid end)()`
}

/**
 * Numeric action arg that may now be a bound LogicValue. Literals (and unset
 * values) keep the legacy JS-side clamp so emitted Lua is byte-identical for
 * static values; dynamic value-sources clamp at runtime in Lua instead.
 */
function clampedNumberArg(
  value: LogicValue | undefined,
  project: ProjectDoc | null | undefined,
  opts: { min?: number; max?: number; fallback: number },
): string {
  const { min, max, fallback } = opts
  if (typeof value !== 'object' || value === null) {
    let n = finite(value, fallback)
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    return String(n)
  }
  let expr = numberSourceExpr(value, project, fallback)
  if (min != null) expr = `math.max(${min}, ${expr})`
  if (max != null) expr = `math.min(${max}, ${expr})`
  return expr
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

function resolveAudioPath(
  project: ProjectDoc | null | undefined,
  audioAssetId: string | undefined,
  fallbackPath: string | undefined,
): string {
  if (audioAssetId && project?.audioAssets?.[audioAssetId]?.path)
    return project.audioAssets[audioAssetId].path
  return fallbackPath ?? ''
}

/**
 * Emit a single Lua statement for a Logic Board action.
 * Unsupported / malformed actions throw so Play and export cannot ship silent no-ops.
 * Feature DoD: every action type must compile to real GameAPI calls or fail loudly.
 */
export class UnsupportedLogicActionError extends Error {
  readonly actionType: string
  readonly detail?: string

  constructor(actionType: string, detail?: string) {
    const tail = detail ? ` (${detail})` : ''
    super(`Unsupported Logic Board action "${actionType}"${tail}`)
    this.name = 'UnsupportedLogicActionError'
    this.actionType = actionType
    this.detail = detail
  }
}

function rejectUnsupportedAction(a: LogicAction, detail?: string): never {
  const type = String((a as { type?: unknown }).type ?? 'unknown')
  throw new UnsupportedLogicActionError(type, detail)
}

export function actionLua(a: LogicAction, ctx: ActionEmitCtx = {}): string {
  const project = ctx.project
  const target = (sel: Parameters<typeof targetExpr>[0]) => targetExpr(sel, project)
  switch (a.type) {
    case 'setPause': {
      const mode = a.mode
      switch (mode) {
        case 'pause':  return `time.pause()`
        case 'resume': return `time.resume()`
        case 'toggle': return `time.togglePause()`
      }
      rejectUnsupportedAction(a, `setPause mode=${String(mode)}`)
    }
    case 'modifyVariable': {
      const key = luaString(a.key)
      const num = numberSourceExpr(a.value ?? 0, project)
      const lo = numberSourceExpr(a.min ?? 0, project)
      const hi = numberSourceExpr(a.max ?? 0, project)
      if (a.scope === 'object') {
        const t = target(a.target ?? 'self')
        const cur = `(objectvar.get(${t}, ${key}) or 0)`
        switch (a.op) {
          case 'set':      return `objectvar.set(${t}, ${key}, ${valueSourceExpr(a.value ?? 0, project)})`
          case 'add':      return `objectvar.add(${t}, ${key}, ${num})`
          case 'subtract': return `objectvar.add(${t}, ${key}, -(${num}))`
          case 'multiply': return `objectvar.set(${t}, ${key}, ${cur} * (${num}))`
          case 'divide':   return `objectvar.set(${t}, ${key}, ${cur} / (${num}))`
          case 'clamp':    return `objectvar.set(${t}, ${key}, math.max(${lo}, math.min(${hi}, ${cur})))`
        }
      } else {
        const cur = `(global.get(${key}) or 0)`
        switch (a.op) {
          case 'set':      return `global.set(${key}, ${valueSourceExpr(a.value ?? 0, project)})`
          case 'add':      return `global.add(${key}, ${num})`
          case 'subtract': return `global.add(${key}, -(${num}))`
          case 'multiply': return `global.set(${key}, ${cur} * (${num}))`
          case 'divide':   return `global.set(${key}, ${cur} / (${num}))`
          case 'clamp':    return `global.set(${key}, math.max(${lo}, math.min(${hi}, ${cur})))`
        }
      }
      return rejectUnsupportedAction(a, `modifyVariable op=${String(a.op)}`)
    }
    case 'setVariable':
      return `global.set(${luaString(a.key)}, ${valueSourceExpr(a.value, project)})`
    case 'addVariable':
      return `global.add(${luaString(a.key)}, ${numberSourceExpr(a.amount, project)})`
    case 'setPosition':
      return `entity.setPosition(${target(a.target)}, ${numberSourceExpr(a.x, project)}, ${numberSourceExpr(a.y, project)})`
    case 'setVelocity':
      return `entity.setVelocity(${target(a.target)}, ${numberSourceExpr(a.vx, project)}, ${numberSourceExpr(a.vy, project)})`
    case 'playSound': {
      const path = resolveAudioPath(ctx.project, a.audioAssetId, a.path)
      return `audio.playSound(${luaString(path)}, ${a.volume ?? 1}, ${a.pitch ?? 1})`
    }
    case 'playMusic': {
      const path = resolveAudioPath(ctx.project, a.audioAssetId, a.path)
      return `audio.playMusic(${luaString(path)}, ${a.loop !== false})`
    }
    case 'stopAllAudio':
      return `audio.stopAll()`
    case 'controlMusic': {
      const mode = a.mode
      switch (mode) {
        case 'stop':   return `audio.stopMusic()`
        case 'pause':  return `audio.pauseMusic()`
        case 'resume': return `audio.resumeMusic()`
      }
      return rejectUnsupportedAction(a, `controlMusic mode=${String(mode)}`)
    }
    case 'setVolume': {
      const vol = numberSourceExpr(a.volume, project)
      switch (a.channel) {
        case 'master': return `audio.setMasterVolume(${vol})`
        case 'music':  return `audio.setMusicVolume(${vol})`
        case 'sfx':    return `audio.setSfxVolume(${vol})`
      }
      return rejectUnsupportedAction(a, `setVolume channel=${String(a.channel)}`)
    }
    case 'fadeMusic':
      return `audio.fadeMusic(${numberSourceExpr(a.volume, project)}, ${numberSourceExpr(a.seconds, project)})`
    case 'destroyEntity':
      return `entity.destroy(${target(a.target)})`
    case 'clickToDestroy':
      return 'entity.destroy(self)'
    case 'spawnEntity': {
      const cls = luaString(a.className)
      const base = a.imagePoint
        ? `(function() local _px, _py = entity.imagePoint(self, ${luaString(a.imagePoint)}); return object.spawn(${cls}, _px, _py) end)()`
        : `object.spawn(${cls}, ${numberSourceExpr(a.x, project)}, ${numberSourceExpr(a.y, project)})`
      const spawn = !a.inheritFlip
        ? base
        : `(function() local _nid = ${base}; entity.setFlip(_nid, entity.flipX(self) and 'mirror' or 'normal', entity.flipY(self) and 'mirror' or 'normal'); return _nid end)()`
      return spawnWithVelocity(spawn, a, project)
    }
    case 'spawnEntityAtPointer': {
      const cls = luaString(a.className)
      const spawn = `(function() ${luaPointerWorldPairStmt()}; return object.spawn(${cls}, _mx, _my) end)()`
      return spawnWithVelocity(spawn, a, project)
    }
    case 'moveInDirection': {
      const t = target(a.target)
      const s = numberSourceExpr(a.speed, project)
      switch (a.direction) {
        case 'up':
          return `entity.setVelocity(${t}, 0, -(${s}))`
        case 'down':
          return `entity.setVelocity(${t}, 0, ${s})`
        case 'left':
          return `entity.setVelocity(${t}, -(${s}), 0)`
        case 'right':
          return `entity.setVelocity(${t}, ${s}, 0)`
        case 'forward':
          return `(function() local _d = entity.flipX(${t}) and -1 or 1; entity.setVelocity(${t}, _d * (${s}), 0) end)()`
        case 'backward':
          return `(function() local _d = entity.flipX(${t}) and -1 or 1; entity.setVelocity(${t}, -_d * (${s}), 0) end)()`
      }
      return rejectUnsupportedAction(a,
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
      return rejectUnsupportedAction(a,
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
      return rejectUnsupportedAction(a,
        `direction=${String((a as { direction?: unknown }).direction)}`)
    }
    case 'clearMovementIntent':
      return `movement.clearIntent(${target(a.target)})`
    case 'requestPlatformerJump':
      return `platformer.requestJump(${target(a.target)})`
    case 'setPlatformerMaxSpeed':
      return `platformer.setMaxSpeed(${target(a.target)}, ${numberSourceExpr(a.speed, project)})`
    case 'setPlatformerJumpForce':
      return `platformer.setJumpForce(${target(a.target)}, ${numberSourceExpr(a.force, project)})`
    case 'setPlatformerGravity':
      return `platformer.setGravity(${target(a.target)}, ${numberSourceExpr(a.gravity, project)})`
    case 'setTopDownMaxSpeed':
      return `topDown.setMaxSpeed(${target(a.target)}, ${numberSourceExpr(a.speed, project)})`
    case 'setTopDownAcceleration':
      return `topDown.setAcceleration(${target(a.target)}, ${numberSourceExpr(a.acceleration, project)})`
    case 'setTopDownFriction':
      return `topDown.setFriction(${target(a.target)}, ${numberSourceExpr(a.friction, project)})`
    case 'setTopDownFourDirections':
      return `topDown.setFourDirections(${target(a.target)}, ${a.enabled ? 'true' : 'false'})`
    case 'damageEntity':
      return `entity.damage(${target(a.target)}, ${numberSourceExpr(a.amount, project)})`
    case 'healEntity': {
      const t = target(a.target)
      const amount = numberSourceExpr(a.amount, project)
      return `(function() local _c,_m=entity.health(${t}); if _c ~= nil then entity.setHealth(${t}, math.min(_m, _c + ${amount}), _m) end end)()`
    }
    case 'setEntityHealth':
      return a.maxHp != null
        ? `entity.setHealth(${target(a.target)}, ${numberSourceExpr(a.currentHp, project)}, ${numberSourceExpr(a.maxHp, project)})`
        : `entity.setHealth(${target(a.target)}, ${numberSourceExpr(a.currentHp, project)})`
    case 'setLinearMoverDirection':
      return `linearMover.setDirection(${target(a.target)}, ${numberSourceExpr(a.directionX, project)}, ${numberSourceExpr(a.directionY, project)})`
    case 'setLinearMoverSpeed':
      return `linearMover.setSpeed(${target(a.target)}, ${numberSourceExpr(a.speed, project)})`
    case 'pauseLinearMover':
      return `linearMover.pause(${target(a.target)})`
    case 'resumeLinearMover':
      return `linearMover.resume(${target(a.target)})`
    case 'setMagnetEnabled':
      return `magnet.setEnabled(${target(a.target)}, ${a.enabled ? 'true' : 'false'})`
    case 'setMagnetTargetTag':
      return `magnet.setTargetTag(${target(a.target)}, ${luaString(a.tag)})`
    case 'setMagnetRadius':
      return `magnet.setRadius(${target(a.target)}, ${numberSourceExpr(a.radius, project)})`
    case 'setMagnetPullSpeed':
      return `magnet.setPullSpeed(${target(a.target)}, ${numberSourceExpr(a.speed, project)})`
    case 'setHordeTargetClass':
      return `horde.setTargetClass(${target(a.target)}, ${luaString(a.className)})`
    case 'setHordeWeights':
      return `horde.setWeights(${target(a.target)}, ${numberSourceExpr(a.chaseWeight, project)}, ${numberSourceExpr(a.separationWeight, project)})`
    case 'setHordeMaxSpeed':
      return `horde.setMaxSpeed(${target(a.target)}, ${numberSourceExpr(a.speed, project)})`
    case 'setHordeSeparationRadius':
      return `horde.setSeparationRadius(${target(a.target)}, ${numberSourceExpr(a.radius, project)})`
    case 'setAutoDestroyLifespan':
      return `autoDestroy.setLifespan(${target(a.target)}, ${numberSourceExpr(a.lifespan, project)})`
    case 'cancelAutoDestroy':
      return `autoDestroy.cancel(${target(a.target)})`
    case 'emitEvent':
      return a.payloadKey
        ? `event.emit(${luaString(a.name)}, { [${luaString(a.payloadKey)}] = ${luaValue(a.payloadValue ?? '')} })`
        : `event.emit(${luaString(a.name)})`
    case 'startDialog':
      return a.source === 'component'
        ? `dialog.startComponent(${target(a.target)})`
        : `dialog.start(${target(a.target)}, ${luaString(a.dialogId ?? '')})`
    case 'endDialog':
      return `dialog.finish()`
    case 'toggleLogicEvent':
      return `_logic_on[${ruleKeyExpr(a.eventId, ctx.eventSlugs)}] = ${a.enabled ? 'true' : 'false'}`
    case 'applyImpulse':
      return `physics.applyImpulse(${target(a.target)}, ${numberSourceExpr(a.ix, project)}, ${numberSourceExpr(a.iy, project)})`
    case 'applyForce':
      return `physics.applyForce(${target(a.target)}, ${numberSourceExpr(a.fx, project)}, ${numberSourceExpr(a.fy, project)})`
    case 'setRotation':
      return `entity.setRotation(${target(a.target)}, ${numberSourceExpr(a.angle, project)})`
    case 'setScale':
      return `entity.setScale(${target(a.target)}, ${numberSourceExpr(a.scaleX, project)}, ${numberSourceExpr(a.scaleY, project)})`
    case 'playAnimation':
      return `animation.play(${target(a.target)}, ${luaString(a.clipName)})`
    case 'setFlip':
      // Per-axis mode strings: entity.setFlip resolves keep/normal/mirror/toggle.
      return `entity.setFlip(${target(a.target)}, ${luaString(a.flipX)}, ${luaString(a.flipY)})`
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
    case 'setText': {
      const fmt = a.format && a.format !== 'text'
      let expr = fmt
        ? `_logic_fmt(${valueSourceExpr(a.value, project)}, ${luaString(a.format!)}, ${finite(a.digits)})`
        : `_logic_tostr(${valueSourceExpr(a.value, project)})`
      if (a.prefix) expr = `${luaString(a.prefix)} .. ${expr}`
      if (a.suffix) expr = `${expr} .. ${luaString(a.suffix)}`
      return `text.set(${target(a.target)}, ${expr})`
    }
    case 'setTextColor': {
      const m = /^#?([0-9a-fA-F]{6})$/.exec(a.hexColor || '')
      const hex = m ? m[1] : 'ffffff'
      const r = (parseInt(hex.slice(0, 2), 16) / 255).toFixed(4)
      const g = (parseInt(hex.slice(2, 4), 16) / 255).toFixed(4)
      const b = (parseInt(hex.slice(4, 6), 16) / 255).toFixed(4)
      return `text.setColor(${target(a.target)}, ${r}, ${g}, ${b}, 1)`
    }
    case 'loadScene': {
      const fade = finite(a.fadeSeconds)
      return fade > 0
        ? `scene.load(${luaString(a.sceneName)}, ${fade})`
        : `scene.load(${luaString(a.sceneName)})`
    }
    case 'restartScene':
      return `scene.restart()`
    case 'centerCameraOn':
    case 'setCameraTarget':
      return `camera.centerOn(${target(a.target)})`
    case 'followCamera':
      return `camera.follow(${target(a.target)})`
    case 'stopCameraFollow':
      return `camera.stopFollowing()`
    case 'useDefaultCameraTarget':
      return `camera.useDefaultTarget()`
    case 'cameraShake':
      return `camera.shake(${clampedNumberArg(a.trauma, project, { min: 0, max: 1, fallback: 0.35 })}, ${clampedNumberArg(a.durationSeconds, project, { min: 0.05, max: 10, fallback: 0.5 })})`
    case 'debugLog':
      return `debug.log(${luaString(a.message)})`
    case 'wait':
      return `${WAIT_SENTINEL_PREFIX} by emitActionSequence`
    case 'repeatTimes':
      return `${REPEAT_TIMES_SENTINEL_PREFIX} by emitActionSequence`
    case 'moveByOffset':
      return `grid.moveByOffset(${target(a.target)}, ${numberSourceExpr(a.dx, project)}, ${numberSourceExpr(a.dy, project)})`
    case 'snapToGrid':
      return `grid.snapToGrid(${target(a.target)}, ${numberSourceExpr(a.cellSize, project, 32)})`
    case 'setEntityShader':
      return `shaders.setEntity(${target(a.target)}, ${luaString(a.shader)})`
    case 'setScreenShader':
      return `shaders.setScreen(${luaString(a.shader)})`
    case 'saveGame':
      return `save.writeGame(${luaString(a.slot || 'main')})`
    case 'loadGame':
      return `save.loadGame(${luaString(a.slot || 'main')})`
    case 'deleteSave':
      return `save.delete(${luaString(a.slot || 'main')})`
    case 'setCameraZoom':
      // Preserve the legacy `|| 1` guard (0 → 1) for literals; bind dynamically otherwise.
      return typeof a.zoom === 'object' && a.zoom !== null
        ? `camera.setZoom(${numberSourceExpr(a.zoom, project, 1)})`
        : `camera.setZoom(${Number(a.zoom) || 1})`
    case 'panCamera':
      return `camera.move(${numberSourceExpr(a.dx, project)}, ${numberSourceExpr(a.dy, project)})`
    case 'setCameraPosition':
      return `camera.setPosition(${numberSourceExpr(a.x, project)}, ${numberSourceExpr(a.y, project)})`
    case 'setTimeScale':
      return `time.setScale(${clampedNumberArg(a.scale, project, { min: 0, fallback: 0 })})`
    case 'spawnAtEntity': {
      const cls = luaString(a.className)
      const t = target(a.target)
      const spawn = `(function() local _sx, _sy = entity.position(${t}); return object.spawn(${cls}, _sx, _sy) end)()`
      return spawnWithVelocity(spawn, a, project)
    }
    case 'moveToward': {
      const t = target(a.target)
      const tow = target(a.toward)
      const spd = numberSourceExpr(a.speed, project)
      return `(function() local _tx,_ty=entity.position(${t}); local _wx,_wy=entity.position(${tow}); local _dx=_wx-_tx; local _dy=_wy-_ty; local _d=math.sqrt(_dx*_dx+_dy*_dy); if _d>0 then entity.setVelocity(${t},_dx/_d*(${spd}),_dy/_d*(${spd})) else entity.setVelocity(${t},0,0) end end)()`
    }
    case 'lookAtTarget': {
      const t = target(a.target)
      const tow = target(a.toward)
      // Lua 5.4 removed math.atan2; math.atan(y, x) is the two-arg form.
      return `(function() local _tx,_ty=entity.position(${t}); local _wx,_wy=entity.position(${tow}); entity.setRotation(${t},math.atan(_wy-_ty,_wx-_tx)) end)()`
    }
  }
  // Unknown action type (stale project.json, older runtime than the
  // editor expected, malformed payload). Emit a parseable Lua comment
  // so emitActionSequence drops it cleanly instead of compiling
  // undefined into the output and crashing the Lua preview.
  return rejectUnsupportedAction(a)
}
