import type { ProjectDoc } from '../../../types'
import type { LogicAction, TargetSelector } from '../../../types/logic-board'
import { repeatIntervalSeconds } from '../../../utils/logic-board/repeat-interval'
import { fmtClass, targetDisplayLabel } from './board-labels'

export function actionSummaryPlain(
  a: LogicAction,
  project?: ProjectDoc | null,
): string {
  const who = (t: TargetSelector) => targetDisplayLabel(t, project)
  switch (a.type) {
    case 'setVariable':
      return `Set ${a.key} to ${a.value}`
    case 'addVariable':
      return `Add ${a.amount} to ${a.key}`
    case 'setPosition':
      return `Move ${who(a.target)} to (${a.x}, ${a.y})`
    case 'setVelocity':
      return `Set ${who(a.target)} speed to (${a.vx}, ${a.vy})`
    case 'playSound':
      return `Play sound "${a.path || '...'}"`
    case 'playMusic':
      return `Play music "${a.path || '...'}"${a.loop ? ' (loop)' : ''}`
    case 'stopAllAudio':
      return 'Stop all sounds'
    case 'stopMusic':
      return 'Stop music'
    case 'pauseMusic':
      return 'Pause music'
    case 'resumeMusic':
      return 'Resume music'
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
        : `at (${a.x}, ${a.y})`
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
      return `Move ${who(a.target)} ${dir} at speed ${a.speed}`
    }
    case 'controllerMovement':
      return `Move ${who(a.target)} ${a.direction} while active`
    case 'moveController':
      return a.direction === 'stop'
        ? `Stop controller movement for ${who(a.target)}`
        : `Start controller movement for ${who(a.target)} ${a.direction}`
    case 'clearMovementIntent':
      return `Stop controller movement for ${who(a.target)}`
    case 'requestPlatformerJump':
      return `Make ${who(a.target)} jump`
    case 'damageEntity':
      return `Damage ${who(a.target)} by ${a.amount}`
    case 'healEntity':
      return `Heal ${who(a.target)} by ${a.amount}`
    case 'setEntityHealth':
      return a.maxHp != null
        ? `Set ${who(a.target)} HP to ${a.currentHp}/${a.maxHp}`
        : `Set ${who(a.target)} HP to ${a.currentHp}`
    case 'setLinearMoverDirection':
      return `Set linear mover on ${who(a.target)} to (${a.directionX}, ${a.directionY})`
    case 'setLinearMoverSpeed':
      return `Set linear mover speed on ${who(a.target)} to ${a.speed}`
    case 'pauseLinearMover':
      return `Pause linear mover on ${who(a.target)}`
    case 'resumeLinearMover':
      return `Resume linear mover on ${who(a.target)}`
    case 'setMagnetEnabled':
      return a.enabled ? `Enable magnet on ${who(a.target)}` : `Disable magnet on ${who(a.target)}`
    case 'setMagnetTargetTag':
      return `Magnet on ${who(a.target)} attracts tag "${a.tag || '?'}"`
    case 'setHordeTargetClass':
      return `Horde ${who(a.target)} chases ${fmtClass(a.className, project)}`
    case 'setHordeWeights':
      return `Horde ${who(a.target)} chase=${a.chaseWeight} separation=${a.separationWeight}`
    case 'setAutoDestroyLifespan':
      return `Auto destroy ${who(a.target)} in ${a.lifespan}s`
    case 'cancelAutoDestroy':
      return `Cancel auto destroy on ${who(a.target)}`
    case 'emitEvent':
      return `Send message "${a.name || '?'}"`
    case 'toggleLogicEvent':
      return `Turn rule "${a.eventId || '?'}" ${a.enabled ? 'on' : 'off'}`
    case 'applyImpulse':
      return `Push ${who(a.target)} (${a.ix}, ${a.iy})`
    case 'applyForce':
      return `Apply force on ${who(a.target)}`
    case 'setRotation':
      return `Rotate ${who(a.target)}`
    case 'setScale':
      return `Resize ${who(a.target)} to (${a.scaleX}, ${a.scaleY})`
    case 'playAnimation':
      return a.clipName ? `Play "${a.clipName}" on ${who(a.target)}` : `Play animation on ${who(a.target)} — choose clip`
    case 'setFlip': {
      const xLabel = a.flipX ? 'X=on' : 'X=off'
      const yLabel = a.flipY != null ? (a.flipY ? ' Y=on' : ' Y=off') : ''
      return `Flip ${who(a.target)}: ${xLabel}${yLabel}`
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
    case 'setCameraTarget':
      return `Camera follows ${who(a.target)}`
    case 'cameraShake': {
      const dur = a.durationSeconds ?? 0.5
      return `Shake camera (intensity ${a.trauma}, ${dur}s)`
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
      return `Move ${who(a.target)} by (${a.dx}, ${a.dy}) pixels`
    case 'snapToGrid':
      return `Snap ${who(a.target)} to ${a.cellSize}px grid`
    case 'setEntityShader':
      return `Apply ${a.shader.replace(/_/g, ' ')} effect on ${who(a.target)}`
    case 'setScreenShader':
      return `Apply ${a.shader.replace(/_/g, ' ')} on screen`
    case 'startDialog':
      return `Start dialog "${a.dialogId}" on ${who(a.target)}`
    case 'setVariableRandomRange':
      return `Set ${a.key} to random ${a.min}–${a.max}`
    case 'clampVariable':
      return `Clamp ${a.key} to [${a.min}, ${a.max}]`
    case 'multiplyVariable':
      return `Multiply ${a.key} by ${a.factor}`
    case 'saveVariable':
      return `Save "${a.key}" to slot "${a.slot || 'main'}"`
    case 'loadVariable':
      return `Load "${a.key}" from slot "${a.slot || 'main'}"`
    case 'deleteSave':
      return `Delete save slot "${a.slot || 'main'}"`
    case 'setCameraZoom':
      return `Set camera zoom to ${a.zoom}`
    case 'panCamera':
      return `Pan camera by (${a.dx}, ${a.dy})`
    case 'setCameraPosition':
      return `Set camera to (${a.x}, ${a.y})`
    case 'setTimeScale':
      return a.scale === 0
        ? 'Pause time (scale 0)'
        : a.scale === 1
          ? 'Reset time scale (1×)'
          : `Set time scale to ${a.scale}×`
    case 'spawnAtEntity':
      return a.className
        ? `Create "${fmtClass(a.className, project)}" at ${who(a.target)}`
        : `Create at ${who(a.target)} — choose type`
    case 'moveToward':
      return `Move ${who(a.target)} toward ${who(a.toward)} at speed ${a.speed}`
    case 'lookAtTarget':
      return `Rotate ${who(a.target)} to face ${who(a.toward)}`
  }
}
