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
    case 'pauseGame':
      return `time.pause()`
    case 'resumeGame':
      return `time.resume()`
    case 'togglePause':
      return `time.togglePause()`
    case 'modifyVariable': {
      const key = luaString(a.key)
      const num = numberSourceExpr(a.value, project)
      if (a.scope === 'object') {
        const t = target(a.target ?? 'self')
        const cur = `(objectvar.get(${t}, ${key}) or 0)`
        switch (a.op) {
          case 'set':      return `objectvar.set(${t}, ${key}, ${valueSourceExpr(a.value, project)})`
          case 'add':      return `objectvar.add(${t}, ${key}, ${num})`
          case 'subtract': return `objectvar.add(${t}, ${key}, -(${num}))`
          case 'multiply': return `objectvar.set(${t}, ${key}, ${cur} * (${num}))`
          case 'divide':   return `objectvar.set(${t}, ${key}, ${cur} / (${num}))`
        }
      } else {
        const cur = `(global.get(${key}) or 0)`
        switch (a.op) {
          case 'set':      return `global.set(${key}, ${valueSourceExpr(a.value, project)})`
          case 'add':      return `global.add(${key}, ${num})`
          case 'subtract': return `global.add(${key}, -(${num}))`
          case 'multiply': return `global.set(${key}, ${cur} * (${num}))`
          case 'divide':   return `global.set(${key}, ${cur} / (${num}))`
        }
      }
      return unknownActionComment(a, `modifyVariable op=${String(a.op)}`)
    }
    case 'setGlobalVariable':
      return `global.set(${luaString(a.key)}, ${valueSourceExpr(a.value, project)})`
    case 'addGlobalVariable':
      return `global.add(${luaString(a.key)}, ${numberSourceExpr(a.amount, project)})`
    case 'setLocalVariable':
      return `objectvar.set(${target(a.target)}, ${luaString(a.key)}, ${valueSourceExpr(a.value, project)})`
    case 'addLocalVariable':
      return `objectvar.add(${target(a.target)}, ${luaString(a.key)}, ${numberSourceExpr(a.amount, project)})`
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
    case 'stopMusic':
      return `audio.stopMusic()`
    case 'pauseMusic':
      return `audio.pauseMusic()`
    case 'resumeMusic':
      return `audio.resumeMusic()`
    case 'setMusicVolume':
      return `audio.setMusicVolume(${numberSourceExpr(a.volume, project)})`
    case 'setMasterVolume':
      return `audio.setMasterVolume(${numberSourceExpr(a.volume, project)})`
    case 'setSfxVolume':
      return `audio.setSfxVolume(${numberSourceExpr(a.volume, project)})`
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
        : `object.spawn(${cls}, ${Number(a.x) || 0}, ${Number(a.y) || 0})`
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
          return `(function() local _d = entity.flipX(${t}) and -1 or 1; entity.setVelocity(${t}, _d * ${s}, 0) end)()`
        case 'backward':
          return `(function() local _d = entity.flipX(${t}) and -1 or 1; entity.setVelocity(${t}, -_d * ${s}, 0) end)()`
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
      return `dialog.start(${target(a.target)}, ${luaString(a.dialogId)})`
    case 'endDialog':
      return `dialog.finish()`
    case 'toggleLogicEvent':
      return `_logic_on[${ruleKeyExpr(a.eventId, ctx.eventSlugs)}] = ${a.enabled ? 'true' : 'false'}`
    case 'applyImpulse':
      return `physics.applyImpulse(${target(a.target)}, ${Number(a.ix) || 0}, ${Number(a.iy) || 0})`
    case 'applyForce':
      return `physics.applyForce(${target(a.target)}, ${Number(a.fx) || 0}, ${Number(a.fy) || 0})`
    case 'setRotation':
      return `entity.setRotation(${target(a.target)}, ${Number(a.angle) || 0})`
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
    case 'setVariableRandomRange': {
      const min = Number(a.min) || 0
      const max = Number(a.max) || 0
      return `global.set(${luaString(a.key)}, _logic_random_int(${min}, ${max}))`
    }
    case 'clampVariable':
      return `global.set(${luaString(a.key)}, math.max(${Number(a.min) || 0}, math.min(${Number(a.max) || 0}, global.get(${luaString(a.key)}) or 0)))`
    case 'multiplyVariable':
      return `global.set(${luaString(a.key)}, (global.get(${luaString(a.key)}) or 0) * ${Number(a.factor) || 0})`
    case 'saveGame':
      return `save.writeGame(${luaString(a.slot || 'main')})`
    case 'loadGame':
      return `save.loadGame(${luaString(a.slot || 'main')})`
    case 'deleteSave':
      return `save.delete(${luaString(a.slot || 'main')})`
    case 'setCameraZoom':
      return `camera.setZoom(${Number(a.zoom) || 1})`
    case 'panCamera':
      return `camera.move(${Number(a.dx) || 0}, ${Number(a.dy) || 0})`
    case 'setCameraPosition':
      return `camera.setPosition(${Number(a.x) || 0}, ${Number(a.y) || 0})`
    case 'setTimeScale': {
      const scale = Math.max(0, Number(a.scale) || 0)
      return `time.setScale(${scale})`
    }
    case 'spawnAtEntity': {
      const cls = luaString(a.className)
      const t = target(a.target)
      const spawn = `(function() local _sx, _sy = entity.position(${t}); return object.spawn(${cls}, _sx, _sy) end)()`
      return spawnWithVelocity(spawn, a, project)
    }
    case 'moveToward': {
      const t = target(a.target)
      const tow = target(a.toward)
      const spd = Number(a.speed) || 0
      return `(function() local _tx,_ty=entity.position(${t}); local _wx,_wy=entity.position(${tow}); local _dx=_wx-_tx; local _dy=_wy-_ty; local _d=math.sqrt(_dx*_dx+_dy*_dy); if _d>0 then entity.setVelocity(${t},_dx/_d*${spd},_dy/_d*${spd}) else entity.setVelocity(${t},0,0) end end)()`
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
  return unknownActionComment(a)
}
