// ---------------------------------------------------------------------------
// Catalogues + factories + human summaries for the Logic Board GUI.
// Single source of truth for the MVP component set (kept in lock-step with
// types/logic-board.ts and the compiler).
// ---------------------------------------------------------------------------

import type {
  ComparisonOp,
  LogicAction,
  LogicActionType,
  LogicCondition,
  LogicEvent,
  LogicTrigger,
  LogicTriggerType,
} from '../../types/logic-board'
import {
  listActionTypes,
  listConditionTypes,
  listTriggerTypes,
} from '../../utils/logic-board/schema-registry'

export const TRIGGER_TYPES = listTriggerTypes() as LogicTriggerType[]

export const ACTION_TYPES = listActionTypes() as LogicActionType[]

export const CONDITION_TYPES = listConditionTypes() as readonly LogicCondition['type'][]

export const COMPARISON_OPS: ComparisonOp[] = ['==', '!=', '<', '<=', '>', '>=']

export const INPUT_EVENT_TYPES = ['pressed', 'down', 'released'] as const

// ---- factories: build a default instance for a given type -----------------

export function defaultTrigger(type: LogicTriggerType): LogicTrigger {
  switch (type) {
    case 'onStart':
      return { type: 'onStart' }
    case 'onSpawn':
      return { type: 'onSpawn' }
    case 'onUpdate':
      return { type: 'onUpdate' }
    case 'onCollision':
      return { type: 'onCollision', filter: { response: 'solid' } }
    case 'onCollisionEnter':
      return { type: 'onCollisionEnter', filter: { response: 'solid' } }
    case 'onCollisionExit':
      return { type: 'onCollisionExit', filter: { response: 'solid' } }
    case 'onTriggerEnter':
      return { type: 'onTriggerEnter', filter: { response: 'sensor' } }
    case 'onTriggerExit':
      return { type: 'onTriggerExit', filter: { response: 'sensor' } }
    case 'onAnimationEnd':
      return { type: 'onAnimationEnd', clipName: '' }
    case 'onAnimationStart':
      return { type: 'onAnimationStart', clipName: '' }
    case 'onAnimationFrame':
      return { type: 'onAnimationFrame', clipName: '', frameIndex: 0 }
    case 'onAnimationLoop':
      return { type: 'onAnimationLoop', clipName: '' }
    case 'onAnimationChange':
      return { type: 'onAnimationChange', clipName: '' }
    case 'onDestroy':
      return { type: 'onDestroy' }
    case 'onHealthDepleted':
      return { type: 'onHealthDepleted' }
    case 'onDamaged':
      return { type: 'onDamaged' }
    case 'onLeaveScreen':
      return { type: 'onLeaveScreen' }
    case 'onInput':
      return { type: 'onInput', keyCode: 'Space', eventType: 'pressed' }
    case 'onMouseInput':
      return { type: 'onMouseInput', button: 'left', eventType: 'pressed' }
    case 'onObjectClick':
      return { type: 'onObjectClick', button: 'left', radius: 32 }
    case 'onObjectHoverEnter':
      return { type: 'onObjectHoverEnter', radius: 32 }
    case 'onObjectHoverExit':
      return { type: 'onObjectHoverExit', radius: 32 }
    case 'onMessage':
      return { type: 'onMessage', messageName: 'my_event' }
    case 'onDialogMessage':
      return { type: 'onDialogMessage', messageName: 'QuestAccepted' }
    case 'onTimer':
      return { type: 'onTimer', seconds: 1, repeat: true }
  }
}

export function defaultCondition(
  type: (typeof CONDITION_TYPES)[number],
): LogicCondition {
  switch (type) {
    case 'compareVariable':
      return { type: 'compareVariable', key: 'score', operator: '>=', value: 0 }
    case 'compareValues':
      return { type: 'compareValues', left: 0, operator: '>=', right: 0 }
    case 'compareClass':
      return { type: 'compareClass', className: '' }
    case 'isKeyDown':
      return { type: 'isKeyDown', keyCode: 'Space' }
    case 'hasTag':
      return { type: 'hasTag', tag: 'enemy' }
    case 'compareDistance':
      return { type: 'compareDistance', target: 'self', operator: '<=', value: 100 }
    case 'isMouseOver':
      return { type: 'isMouseOver', radius: 32 }
    case 'raycastHit':
      return { type: 'raycastHit', dirX: 1, dirY: 0, length: 100, className: '' }
    case 'chance':
      return { type: 'chance', percent: 50 }
    case 'isSpaceFree':
      return { type: 'isSpaceFree', x: 0, y: 0, w: 32, h: 32 }
    case 'isTileAreaFree':
      return { type: 'isTileAreaFree', x: 0, y: 0, w: 32, h: 32 }
    case 'compareHealth':
      return { type: 'compareHealth', target: 'self', field: 'current', operator: '>', value: 0 }
    case 'isPlatformerGrounded':
      return { type: 'isPlatformerGrounded', target: 'self' }
    case 'compareCount':
      return { type: 'compareCount', className: '', operator: '<=', value: 5 }
    case 'entityExists':
      return { type: 'entityExists', target: 'self' }
    case 'compareVelocity':
      return { type: 'compareVelocity', target: 'self', axis: 'magnitude', operator: '>', value: 0 }
    case 'comparePosition':
      return { type: 'comparePosition', target: 'self', axis: 'x', operator: '>', value: 0 }
    case 'saveExists':
      return { type: 'saveExists', slot: 'main' }
    case 'isDialogActive':
      return { type: 'isDialogActive' }
    case 'isMusicPlaying':
      return { type: 'isMusicPlaying' }
    case 'isPaused':
      return { type: 'isPaused' }
    case 'isOffScreen':
      return { type: 'isOffScreen', target: 'self' }
  }
}

export function defaultAction(type: LogicActionType): LogicAction {
  switch (type) {
    case 'setPause':
      return { type: 'setPause', mode: 'toggle' }
    case 'modifyVariable':
      return { type: 'modifyVariable', scope: 'global', op: 'add', key: 'score', value: 1, target: 'self' }
    case 'setVariable':
      return { type: 'setVariable', key: 'score', value: 0 }
    case 'addVariable':
      return { type: 'addVariable', key: 'score', amount: 1 }
    case 'setPosition':
      return { type: 'setPosition', target: 'self', x: 0, y: 0 }
    case 'setVelocity':
      return { type: 'setVelocity', target: 'self', vx: 0, vy: 0 }
    case 'playSound':
      return { type: 'playSound', path: '', volume: 1, pitch: 1 }
    case 'playMusic':
      return { type: 'playMusic', path: '', loop: true }
    case 'stopAllAudio':
      return { type: 'stopAllAudio' }
    case 'controlMusic':
      return { type: 'controlMusic', mode: 'stop' }
    case 'setText':
      return { type: 'setText', target: 'self', value: { source: 'global', key: 'score' }, prefix: 'Score: ' }
    case 'setTextColor':
      return { type: 'setTextColor', target: 'self', hexColor: '#ffffff' }
    case 'setVolume':
      return { type: 'setVolume', channel: 'music', volume: 1 }
    case 'fadeMusic':
      return { type: 'fadeMusic', volume: 0, seconds: 2 }
    case 'destroyEntity':
      return { type: 'destroyEntity', target: 'self' }
    case 'clickToDestroy':
      return { type: 'clickToDestroy', button: 'right', radius: 32 }
    case 'spawnEntity':
      return { type: 'spawnEntity', className: '', x: 0, y: 0, inheritFlip: false }
    case 'spawnEntityAtPointer':
      return { type: 'spawnEntityAtPointer', className: '' }
    case 'moveInDirection':
      return { type: 'moveInDirection', target: 'self', direction: 'forward', speed: 100 }
    case 'controllerMovement':
      return { type: 'controllerMovement', target: 'self', direction: 'right' }
    case 'moveController':
      return { type: 'moveController', target: 'self', direction: 'right' }
    case 'clearMovementIntent':
      return { type: 'clearMovementIntent', target: 'self' }
    case 'requestPlatformerJump':
      return { type: 'requestPlatformerJump', target: 'self' }
    case 'damageEntity':
      return { type: 'damageEntity', target: 'self', amount: 10 }
    case 'healEntity':
      return { type: 'healEntity', target: 'self', amount: 10 }
    case 'setEntityHealth':
      return { type: 'setEntityHealth', target: 'self', currentHp: 100 }
    case 'setPlatformerMaxSpeed':
      return { type: 'setPlatformerMaxSpeed', target: 'self', speed: 300 }
    case 'setPlatformerJumpForce':
      return { type: 'setPlatformerJumpForce', target: 'self', force: 600 }
    case 'setPlatformerGravity':
      return { type: 'setPlatformerGravity', target: 'self', gravity: 1200 }
    case 'setTopDownMaxSpeed':
      return { type: 'setTopDownMaxSpeed', target: 'self', speed: 250 }
    case 'setTopDownAcceleration':
      return { type: 'setTopDownAcceleration', target: 'self', acceleration: 1500 }
    case 'setTopDownFriction':
      return { type: 'setTopDownFriction', target: 'self', friction: 1200 }
    case 'setTopDownFourDirections':
      return { type: 'setTopDownFourDirections', target: 'self', enabled: true }
    case 'setLinearMoverDirection':
      return { type: 'setLinearMoverDirection', target: 'self', directionX: 1, directionY: 0 }
    case 'setLinearMoverSpeed':
      return { type: 'setLinearMoverSpeed', target: 'self', speed: 300 }
    case 'pauseLinearMover':
      return { type: 'pauseLinearMover', target: 'self' }
    case 'resumeLinearMover':
      return { type: 'resumeLinearMover', target: 'self' }
    case 'setMagnetEnabled':
      return { type: 'setMagnetEnabled', target: 'self', enabled: true }
    case 'setMagnetTargetTag':
      return { type: 'setMagnetTargetTag', target: 'self', tag: 'pickup' }
    case 'setMagnetRadius':
      return { type: 'setMagnetRadius', target: 'self', radius: 200 }
    case 'setMagnetPullSpeed':
      return { type: 'setMagnetPullSpeed', target: 'self', speed: 400 }
    case 'setHordeTargetClass':
      return { type: 'setHordeTargetClass', target: 'self', className: 'Player' }
    case 'setHordeWeights':
      return { type: 'setHordeWeights', target: 'self', chaseWeight: 1, separationWeight: 1 }
    case 'setHordeMaxSpeed':
      return { type: 'setHordeMaxSpeed', target: 'self', speed: 120 }
    case 'setHordeSeparationRadius':
      return { type: 'setHordeSeparationRadius', target: 'self', radius: 48 }
    case 'setAutoDestroyLifespan':
      return { type: 'setAutoDestroyLifespan', target: 'self', lifespan: 5 }
    case 'cancelAutoDestroy':
      return { type: 'cancelAutoDestroy', target: 'self' }
    case 'emitEvent':
      return { type: 'emitEvent', name: 'my_event', payloadKey: '', payloadValue: '' }
    case 'startDialog':
      return { type: 'startDialog', target: 'self', source: 'component', dialogId: '' }
    case 'endDialog':
      return { type: 'endDialog' }
    case 'toggleLogicEvent':
      return { type: 'toggleLogicEvent', eventId: '', enabled: true }
    case 'applyImpulse':
      return { type: 'applyImpulse', target: 'self', ix: 0, iy: -200 }
    case 'applyForce':
      return { type: 'applyForce', target: 'self', fx: 0, fy: -200 }
    case 'setRotation':
      return { type: 'setRotation', target: 'self', angle: 0 }
    case 'setScale':
      return { type: 'setScale', target: 'self', scaleX: 1, scaleY: 1 }
    case 'playAnimation':
      return { type: 'playAnimation', target: 'self', clipName: '' }
    case 'setFlip':
      return { type: 'setFlip', target: 'self', flipX: 'toggle', flipY: 'keep' }
    case 'setVisible':
      return { type: 'setVisible', target: 'self', visible: true }
    case 'setColorTint':
      return { type: 'setColorTint', target: 'self', hexColor: '#ff0000', alpha: 1 }
    case 'loadScene':
      return { type: 'loadScene', sceneName: '' }
    case 'restartScene':
      return { type: 'restartScene' }
    case 'setCameraTarget':
      return { type: 'setCameraTarget', target: 'self' }
    case 'centerCameraOn':
      return { type: 'centerCameraOn', target: 'self' }
    case 'followCamera':
      return { type: 'followCamera', target: 'self' }
    case 'stopCameraFollow':
      return { type: 'stopCameraFollow' }
    case 'useDefaultCameraTarget':
      return { type: 'useDefaultCameraTarget' }
    case 'cameraShake':
      return { type: 'cameraShake', trauma: 0.35, durationSeconds: 0.5 }
    case 'debugLog':
      return { type: 'debugLog', message: '' }
    case 'wait':
      return { type: 'wait', seconds: 1 }
    case 'repeatTimes':
      return { type: 'repeatTimes', count: 3, intervalSeconds: 0.5 }
    case 'moveByOffset':
      return { type: 'moveByOffset', target: 'self', dx: 0, dy: -32 }
    case 'snapToGrid':
      return { type: 'snapToGrid', target: 'self', cellSize: 32 }
    case 'setEntityShader':
      return { type: 'setEntityShader', target: 'self', shader: 'outline' }
    case 'setScreenShader':
      return { type: 'setScreenShader', shader: 'none' }
    case 'saveGame':
      return { type: 'saveGame', slot: 'main' }
    case 'loadGame':
      return { type: 'loadGame', slot: 'main' }
    case 'deleteSave':
      return { type: 'deleteSave', slot: 'main' }
    case 'setCameraZoom':
      return { type: 'setCameraZoom', zoom: 1.5 }
    case 'panCamera':
      return { type: 'panCamera', dx: 0, dy: 0 }
    case 'setCameraPosition':
      return { type: 'setCameraPosition', x: 0, y: 0 }
    case 'setTimeScale':
      return { type: 'setTimeScale', scale: 1 }
    case 'spawnAtEntity':
      return { type: 'spawnAtEntity', className: '', target: 'self' }
    case 'moveToward':
      return { type: 'moveToward', target: 'self', toward: 'other', speed: 150 }
    case 'lookAtTarget':
      return { type: 'lookAtTarget', target: 'self', toward: 'other' }
  }
}

// ---- human-readable summaries (collapsed card) — plain English UI --------

import {
  actionSummaryPlain,
  conditionSummaryPlain,
  eventTriggerSummaryPlain,
  triggerSummaryPlain,
} from './friendly-labels'

export function triggerSummary(t: LogicTrigger): string {
  return triggerSummaryPlain(t)
}

export function conditionSummary(c: LogicCondition): string {
  return conditionSummaryPlain(c)
}

export function actionSummary(a: LogicAction): string {
  return actionSummaryPlain(a)
}

export function eventTitle(e: LogicEvent): string {
  return eventTriggerSummaryPlain(e)
}
