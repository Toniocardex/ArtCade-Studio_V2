import type { ProjectDoc } from '../../../types'
import type { LogicAction, TargetSelector } from '../../../types/logic-board'
import { repeatIntervalSeconds } from '../../../utils/logic-board/repeat-interval'
import { fmtClass, targetDisplayLabel } from './board-labels'
import { valueSummary } from './value-summary'

export function actionSummaryPlain(
  a: LogicAction,
  project?: ProjectDoc | null,
): string {
  const who = (t: TargetSelector) => targetDisplayLabel(t, project)
  switch (a.type) {
    case 'setPause':
      return a.mode === 'pause'
        ? 'Pause the game'
        : a.mode === 'resume'
          ? 'Resume the game'
          : 'Toggle pause'
    case 'modifyVariable': {
      const name = a.scope === 'object' ? `${who(a.target ?? 'self')}.${a.key}` : a.key
      if (a.op === 'clamp') {
        return `Clamp ${name} to [${valueSummary(a.min ?? 0, project)}, ${valueSummary(a.max ?? 0, project)}]`
      }
      const sym =
        a.op === 'set' ? '=' :
        a.op === 'add' ? '+=' :
        a.op === 'subtract' ? '−=' :
        a.op === 'multiply' ? '×=' : '÷='
      return `${name} ${sym} ${valueSummary(a.value ?? 0, project)}`
    }
    case 'setVariable':
      return `Set ${a.key} to ${valueSummary(a.value, project)}`
    case 'addVariable':
      return `Add ${valueSummary(a.amount, project)} to ${a.key}`
    case 'setPosition':
      return `Move ${who(a.target)} to (${valueSummary(a.x, project)}, ${valueSummary(a.y, project)})`
    case 'setVelocity':
      return `Set ${who(a.target)} speed to (${valueSummary(a.vx, project)}, ${valueSummary(a.vy, project)})`
    case 'playSound':
      return `Play sound "${a.path || '...'}"`
    case 'playMusic':
      return `Play music "${a.path || '...'}"${a.loop ? ' (loop)' : ''}`
    case 'stopAllAudio':
      return 'Stop all sounds'
    case 'controlMusic':
      return a.mode === 'stop'
        ? 'Stop music'
        : a.mode === 'pause'
          ? 'Pause music'
          : 'Resume music'
    case 'setText': {
      const v = valueSummary(a.value, project)
      const txt = `${a.prefix ?? ''}${v}${a.suffix ?? ''}`
      return `Set text on ${who(a.target)} to "${txt}"`
    }
    case 'setTextColor':
      return `Set text color on ${who(a.target)} to ${a.hexColor || '#ffffff'}`
    case 'setVolume': {
      const channelLabel =
        a.channel === 'master' ? 'master' : a.channel === 'sfx' ? 'sound effects' : 'music'
      return `Set ${channelLabel} volume to ${valueSummary(a.volume, project)}`
    }
    case 'fadeMusic':
      return `Fade music to ${valueSummary(a.volume, project)} over ${valueSummary(a.seconds, project)}s`
    case 'destroyEntity':
      return `Destroy ${who(a.target)}`
    case 'clickToDestroy': {
      const btn = a.button === 'right' ? 'right-click' : 'left-click'
      const r = a.radius != null ? ` within ${a.radius}px` : ''
      return `Destroy on ${btn}${r}`
    }
    case 'spawnEntity': {
      if (!a.className) return 'Create object - choose what to create'
      const where = a.imagePoint
        ? `at point "${a.imagePoint}"`
        : `at (${valueSummary(a.x, project)}, ${valueSummary(a.y, project)})`
      const flip = a.inheritFlip ? ', same facing' : ''
      return `Create "${fmtClass(a.className, project)}" ${where}${flip}`
    }
    case 'spawnEntityAtPointer':
      return a.className
        ? `Create "${fmtClass(a.className, project)}" at pointer`
        : 'Create at pointer - choose what to create'
    case 'moveInDirection': {
      const dir =
        a.direction === 'forward'
          ? 'forward'
          : a.direction === 'backward'
            ? 'backward'
            : a.direction
      return `Move ${who(a.target)} ${dir} at speed ${valueSummary(a.speed, project)}`
    }
    case 'controllerMovement':
      return `Set ${who(a.target)} direction ${a.direction} while active`
    case 'moveController':
      return a.direction === 'stop'
        ? `Stop fixed movement for ${who(a.target)}`
        : `Keep ${who(a.target)} moving ${a.direction} until changed`
    case 'clearMovementIntent':
      return `Stop controller movement for ${who(a.target)}`
    case 'requestPlatformerJump':
      return `Make ${who(a.target)} jump`
    case 'setPlatformerMaxSpeed':
      return `Set platformer max speed on ${who(a.target)} to ${valueSummary(a.speed, project)}`
    case 'setPlatformerJumpForce':
      return `Set platformer jump force on ${who(a.target)} to ${valueSummary(a.force, project)}`
    case 'setPlatformerGravity':
      return `Set platformer gravity on ${who(a.target)} to ${valueSummary(a.gravity, project)}`
    case 'setTopDownMaxSpeed':
      return `Set top-down max speed on ${who(a.target)} to ${valueSummary(a.speed, project)}`
    case 'setTopDownAcceleration':
      return `Set top-down acceleration on ${who(a.target)} to ${valueSummary(a.acceleration, project)}`
    case 'setTopDownFriction':
      return `Set top-down friction on ${who(a.target)} to ${valueSummary(a.friction, project)}`
    case 'setTopDownFourDirections':
      return a.enabled
        ? `Constrain ${who(a.target)} to 4-direction movement`
        : `Allow free movement for ${who(a.target)}`
    case 'damageEntity':
      return `Damage ${who(a.target)} by ${valueSummary(a.amount, project)}`
    case 'healEntity':
      return `Heal ${who(a.target)} by ${valueSummary(a.amount, project)}`
    case 'setEntityHealth':
      return a.maxHp != null
        ? `Set ${who(a.target)} HP to ${valueSummary(a.currentHp, project)}/${valueSummary(a.maxHp, project)}`
        : `Set ${who(a.target)} HP to ${valueSummary(a.currentHp, project)}`
    case 'setLinearMoverDirection':
      return `Set linear mover on ${who(a.target)} to (${valueSummary(a.directionX, project)}, ${valueSummary(a.directionY, project)})`
    case 'setLinearMoverSpeed':
      return `Set linear mover speed on ${who(a.target)} to ${valueSummary(a.speed, project)}`
    case 'pauseLinearMover':
      return `Pause linear mover on ${who(a.target)}`
    case 'resumeLinearMover':
      return `Resume linear mover on ${who(a.target)}`
    case 'setMagnetEnabled':
      return a.enabled ? `Enable magnet on ${who(a.target)}` : `Disable magnet on ${who(a.target)}`
    case 'setMagnetTargetTag':
      return `Magnet on ${who(a.target)} attracts tag "${a.tag || '?'}"`
    case 'setMagnetRadius':
      return `Set magnet radius on ${who(a.target)} to ${valueSummary(a.radius, project)}`
    case 'setMagnetPullSpeed':
      return `Set magnet pull speed on ${who(a.target)} to ${valueSummary(a.speed, project)}`
    case 'setHordeTargetClass':
      return `Horde ${who(a.target)} chases ${fmtClass(a.className, project)}`
    case 'setHordeWeights':
      return `Horde ${who(a.target)} chase=${valueSummary(a.chaseWeight, project)} separation=${valueSummary(a.separationWeight, project)}`
    case 'setHordeMaxSpeed':
      return `Set horde max speed on ${who(a.target)} to ${valueSummary(a.speed, project)}`
    case 'setHordeSeparationRadius':
      return `Set horde separation radius on ${who(a.target)} to ${valueSummary(a.radius, project)}`
    case 'setAutoDestroyLifespan':
      return `Auto destroy ${who(a.target)} in ${valueSummary(a.lifespan, project)}s`
    case 'cancelAutoDestroy':
      return `Cancel auto destroy on ${who(a.target)}`
    case 'emitEvent':
      return `Broadcast event "${a.name || '?'}"`
    case 'toggleLogicEvent':
      return `Turn rule "${a.eventId || '?'}" ${a.enabled ? 'on' : 'off'}`
    case 'applyImpulse':
      return `Push ${who(a.target)} (${valueSummary(a.ix, project)}, ${valueSummary(a.iy, project)})`
    case 'applyForce':
      return `Apply force on ${who(a.target)}`
    case 'setRotation':
      return `Rotate ${who(a.target)}`
    case 'setScale':
      return `Resize ${who(a.target)} to (${valueSummary(a.scaleX, project)}, ${valueSummary(a.scaleY, project)})`
    case 'playAnimation':
      return a.clipName ? `Play "${a.clipName}" on ${who(a.target)}` : `Play animation on ${who(a.target)} — choose clip`
    case 'setFlip': {
      const axisLabel = (mode: string, axis: string): string | null => {
        if (mode === 'keep') return null
        if (mode === 'toggle') return `${axis} toggle`
        return `${axis} ${mode === 'mirror' ? 'mirror' : 'normal'}`
      }
      const parts = [axisLabel(a.flipX, 'X'), axisLabel(a.flipY, 'Y')].filter(Boolean)
      return parts.length > 0
        ? `Flip ${who(a.target)}: ${parts.join(', ')}`
        : `Flip ${who(a.target)}: no change`
    }
    case 'setVisible':
      return a.visible ? `Show ${who(a.target)}` : `Hide ${who(a.target)}`
    case 'setColorTint':
      return `Tint ${who(a.target)} ${a.hexColor}`
    case 'loadScene':
      return a.fadeSeconds
        ? `Load level "${a.sceneName || '?'}" with fade`
        : `Load level "${a.sceneName || '?'}"`
    case 'restartScene':
      return 'Restart current level'
    case 'centerCameraOn':
    case 'setCameraTarget':
      return `Center camera on ${who(a.target)}`
    case 'followCamera':
      return `Follow ${who(a.target)} with camera`
    case 'stopCameraFollow':
      return 'Stop camera follow'
    case 'useDefaultCameraTarget':
      return 'Use Camera Target component'
    case 'cameraShake': {
      const dur = valueSummary(a.durationSeconds ?? 0.5, project)
      return `Shake camera (intensity ${valueSummary(a.trauma, project)}, ${dur}s)`
    }
    case 'debugLog':
      return a.message ? `Log: ${a.message}` : 'Log message'
    case 'wait':
      return a.then?.length
        ? `Wait ${a.seconds}s, then more actions`
        : `Wait ${a.seconds} seconds`
    case 'repeatTimes': {
      const n = Math.max(1, Math.floor(Number(a.count) || 1))
      const every = repeatIntervalSeconds(a.intervalSeconds)
      const nested = a.actions?.length ?? 0
      const scope = nested > 0
        ? `${nested} nested action${nested === 1 ? '' : 's'}`
        : 'next actions in list'
      const pace =
        every > 0 ? `, every ${every}s` : ', instantly (0s interval)'
      return `Repeat ${n} times${pace} (${scope})`
    }
    case 'moveByOffset':
      return `Move ${who(a.target)} by (${valueSummary(a.dx, project)}, ${valueSummary(a.dy, project)}) pixels`
    case 'snapToGrid':
      return `Snap ${who(a.target)} to ${valueSummary(a.cellSize, project)}px grid`
    case 'setEntityShader':
      return `Apply ${a.shader.replace(/_/g, ' ')} effect on ${who(a.target)}`
    case 'setScreenShader':
      return `Apply ${a.shader.replace(/_/g, ' ')} on screen`
    case 'startDialog':
      return a.source === 'component'
        ? `Start dialog from ${who(a.target)} component`
        : `Start dialog "${a.dialogId ?? ''}" on ${who(a.target)}`
    case 'endDialog':
      return 'End active dialog'
    case 'saveGame':
      return `Save game to slot "${a.slot || 'main'}"`
    case 'loadGame':
      return `Load game from slot "${a.slot || 'main'}"`
    case 'deleteSave':
      return `Delete save slot "${a.slot || 'main'}"`
    case 'setCameraZoom':
      return `Set camera zoom to ${valueSummary(a.zoom, project)}`
    case 'panCamera':
      return `Pan camera by (${valueSummary(a.dx, project)}, ${valueSummary(a.dy, project)})`
    case 'setCameraPosition':
      return `Set camera to (${valueSummary(a.x, project)}, ${valueSummary(a.y, project)})`
    case 'setTimeScale':
      return a.scale === 0
        ? 'Pause time (scale 0)'
        : a.scale === 1
          ? 'Reset time scale (1×)'
          : `Set time scale to ${valueSummary(a.scale, project)}×`
    case 'spawnAtEntity':
      return a.className
        ? `Create "${fmtClass(a.className, project)}" at ${who(a.target)}`
        : `Create at ${who(a.target)} — choose type`
    case 'moveToward':
      return `Move ${who(a.target)} toward ${who(a.toward)} at speed ${valueSummary(a.speed, project)}`
    case 'lookAtTarget':
      return `Rotate ${who(a.target)} to face ${who(a.toward)}`
  }
}
