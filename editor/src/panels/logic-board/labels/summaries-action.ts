import type { ProjectDoc } from '../../../types'
import type { LogicAction, TargetSelector } from '../../../types/logic-board'
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
      return `Move ${who} to (${a.x}, ${a.y})`
    case 'setVelocity':
      return `Set ${who} speed to (${a.vx}, ${a.vy})`
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
      return `Destroy ${who}`
    case 'spawnEntity': {
      if (!a.className) return 'Create object - choose what to create'
      const where = a.imagePoint
        ? `at point "${a.imagePoint}"`
        : `at (${a.x}, ${a.y})`
      const flip = a.inheritFlip ? ', same facing' : ''
      return `Create "${fmtClass(a.className, project)}" ${where}${flip}`
    }
    case 'moveInDirection': {
      const dir =
        a.direction === 'forward'
          ? 'forward'
          : a.direction === 'backward'
            ? 'backward'
            : a.direction
      return `Move ${who} ${dir} at speed ${a.speed}`
    }
    case 'controllerMovement':
      return `Move ${who} ${a.direction} while active`
    case 'moveController':
      return a.direction === 'stop'
        ? `Stop controller movement for ${who}`
        : `Start controller movement for ${who} ${a.direction}`
    case 'clearMovementIntent':
      return `Stop controller movement for ${who}`
    case 'requestPlatformerJump':
      return `Make ${who} jump`
    case 'damageEntity':
      return `Damage ${who} by ${a.amount}`
    case 'healEntity':
      return `Heal ${who} by ${a.amount}`
    case 'setEntityHealth':
      return a.maxHp != null
        ? `Set ${who} HP to ${a.currentHp}/${a.maxHp}`
        : `Set ${who} HP to ${a.currentHp}`
    case 'setLinearMoverDirection':
      return `Set linear mover on ${who} to (${a.directionX}, ${a.directionY})`
    case 'setLinearMoverSpeed':
      return `Set linear mover speed on ${who} to ${a.speed}`
    case 'pauseLinearMover':
      return `Pause linear mover on ${who}`
    case 'resumeLinearMover':
      return `Resume linear mover on ${who}`
    case 'setMagnetEnabled':
      return a.enabled ? `Enable magnet on ${who}` : `Disable magnet on ${who}`
    case 'setMagnetTargetTag':
      return `Magnet on ${who} attracts tag "${a.tag || '?'}"`
    case 'setHordeTargetClass':
      return `Horde ${who} chases ${fmtClass(a.className, project)}`
    case 'setHordeWeights':
      return `Horde ${who} chase=${a.chaseWeight} separation=${a.separationWeight}`
    case 'setAutoDestroyLifespan':
      return `Auto destroy ${who} in ${a.lifespan}s`
    case 'cancelAutoDestroy':
      return `Cancel auto destroy on ${who}`
    case 'emitEvent':
      return `Send message "${a.name || '?'}"`
    case 'toggleLogicEvent':
      return `Turn rule "${a.eventId || '?'}" ${a.enabled ? 'on' : 'off'}`
    case 'applyImpulse':
      return `Push ${who} (${a.ix}, ${a.iy})`
    case 'applyForce':
      return `Apply force on ${who}`
    case 'setRotation':
      return `Rotate ${who}`
    case 'setScale':
      return `Resize ${who} to (${a.scaleX}, ${a.scaleY})`
    case 'playAnimation':
      return a.clipName ? `Play "${a.clipName}" on ${who}` : `Play animation on ${who} — choose clip`
    case 'setFlip': {
      const xLabel = a.flipX ? 'X=on' : 'X=off'
      const yLabel = a.flipY != null ? (a.flipY ? ' Y=on' : ' Y=off') : ''
      return `Flip ${who}: ${xLabel}${yLabel}`
    }
    case 'setVisible':
      return a.visible ? `Show ${who}` : `Hide ${who}`
    case 'setColorTint':
      return `Tint ${who} ${a.hexColor}`
    case 'loadScene':
      return a.fadeSeconds
        ? `Load level "${a.sceneName || '?'}" with fade`
        : `Load level "${a.sceneName || '?'}"`
    case 'restartScene':
      return 'Restart current level'
    case 'setCameraTarget':
      return `Camera follows ${who}`
    case 'debugLog':
      return a.message ? `Log: ${a.message}` : 'Log message'
    case 'wait':
      return a.then?.length
        ? `Wait ${a.seconds}s, then more actions`
        : `Wait ${a.seconds} seconds`
    case 'moveByOffset':
      return `Move ${who} by (${a.dx}, ${a.dy}) pixels`
    case 'snapToGrid':
      return `Snap ${who} to ${a.cellSize}px grid`
    case 'setEntityShader':
      return `Apply ${a.shader.replace(/_/g, ' ')} effect on ${who}`
    case 'setScreenShader':
      return `Apply ${a.shader.replace(/_/g, ' ')} on screen`
  }
}
