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
      return { type: 'onSpawn', className: '' }
    case 'onUpdate':
      return { type: 'onUpdate' }
    case 'onCollision':
      return { type: 'onCollision', withClass: '' }
    case 'onTriggerEnter':
      return { type: 'onTriggerEnter', withClass: '' }
    case 'onTriggerExit':
      return { type: 'onTriggerExit', withClass: '' }
    case 'onAnimationEnd':
      return { type: 'onAnimationEnd', clipName: '' }
    case 'onDestroy':
      return { type: 'onDestroy' }
    case 'onInput':
      return { type: 'onInput', keyCode: 'Space', eventType: 'pressed' }
    case 'onMouseInput':
      return { type: 'onMouseInput', button: 'left', eventType: 'pressed' }
    case 'onMessage':
      return { type: 'onMessage', messageName: 'my_event' }
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
    case 'compareHealth':
      return { type: 'compareHealth', target: 'self', field: 'current', operator: '>', value: 0 }
    case 'isPlatformerGrounded':
      return { type: 'isPlatformerGrounded', target: 'self' }
  }
}

export function defaultAction(type: LogicActionType): LogicAction {
  switch (type) {
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
    case 'destroyEntity':
      return { type: 'destroyEntity', target: 'self' }
    case 'spawnEntity':
      return { type: 'spawnEntity', className: '', x: 0, y: 0, inheritFlip: false }
    case 'moveInDirection':
      return { type: 'moveInDirection', target: 'self', direction: 'forward', speed: 100 }
    case 'controllerMovement':
      return { type: 'controllerMovement', target: 'self', direction: 'right' }
    case 'moveController':
      return { type: 'moveController', target: 'self', direction: 'right' }
    case 'setMovementIntent':
      return { type: 'setMovementIntent', target: 'self', directionX: 1, directionY: 0 }
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
    case 'setHordeTargetClass':
      return { type: 'setHordeTargetClass', target: 'self', className: 'Player' }
    case 'setHordeWeights':
      return { type: 'setHordeWeights', target: 'self', chaseWeight: 1, separationWeight: 1 }
    case 'setAutoDestroyLifespan':
      return { type: 'setAutoDestroyLifespan', target: 'self', lifespan: 5 }
    case 'cancelAutoDestroy':
      return { type: 'cancelAutoDestroy', target: 'self' }
    case 'emitEvent':
      return { type: 'emitEvent', name: 'my_event', payloadKey: '', payloadValue: '' }
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
    case 'debugLog':
      return { type: 'debugLog', message: '' }
    case 'wait':
      return { type: 'wait', seconds: 1 }
    case 'moveByOffset':
      return { type: 'moveByOffset', target: 'self', dx: 0, dy: -32 }
    case 'snapToGrid':
      return { type: 'snapToGrid', target: 'self', cellSize: 32 }
    case 'setEntityShader':
      return { type: 'setEntityShader', target: 'self', shader: 'outline' }
    case 'setScreenShader':
      return { type: 'setScreenShader', shader: 'none' }
  }
}

// ---- human-readable summaries (collapsed card) — plain English UI --------

import {
  actionSummaryPlain,
  conditionSummaryPlain,
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
  return triggerSummaryPlain(e.trigger)
}
