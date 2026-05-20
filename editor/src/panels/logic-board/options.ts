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
  TargetSelector,
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
    case 'setGlobalState':
      return { type: 'setGlobalState', key: 'level', value: 1 }
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

// ---- human-readable summaries (collapsed card) ----------------------------

export function triggerSummary(t: LogicTrigger): string {
  switch (t.type) {
    case 'onStart':
      return 'onStart · once'
    case 'onUpdate':
      return 'onUpdate · every tick'
    case 'onCollision':
      return `onCollision · with "${t.withClass || '?'}"`
    case 'onTriggerEnter':
      return `onTriggerEnter · "${t.withClass || '?'}"`
    case 'onTriggerExit':
      return `onTriggerExit · "${t.withClass || '?'}"`
    case 'onAnimationEnd':
      return `onAnimationEnd · "${t.clipName || 'any'}"`
    case 'onDestroy':
      return 'onDestroy'
    case 'onInput':
      return `onInput · key "${t.keyCode}" · ${t.eventType}`
    case 'onMouseInput':
      return `onMouseInput · ${t.button} · ${t.eventType}`
    case 'onMessage':
      return `onMessage · "${t.messageName || '?'}"`
    case 'onTimer':
      return `onTimer · every ${t.seconds}s${t.repeat ? ' · repeat' : ''}`
  }
}

export function conditionSummary(c: LogicCondition): string {
  switch (c.type) {
    case 'compareVariable':
      return `state.${c.key} ${c.operator} ${c.value}`
    case 'compareClass':
      return `touching "${c.className || '?'}"`
    case 'isKeyDown':
      return `key "${c.keyCode}" down`
    case 'hasTag':
      return `has tag "${c.tag || '?'}"`
    case 'compareDistance':
      return `dist(${targetLabel(c.target)}) ${c.operator} ${c.value}`
    case 'isMouseOver':
      return `mouse over (r=${c.radius ?? 32})`
    case 'raycastHit':
      return `raycast (${c.dirX},${c.dirY})·${c.length}${c.className ? ` → "${c.className}"` : ''}`
    case 'chance':
      return `chance ${c.percent}%`
    case 'isSpaceFree':
      return `space free @ (${c.x},${c.y}) ${c.w}×${c.h}`
  }
}

export function actionSummary(a: LogicAction): string {
  switch (a.type) {
    case 'setVariable':
      return `setVariable ${a.key} = ${a.value}`
    case 'addVariable':
      return `addVariable ${a.key} += ${a.amount}`
    case 'setPosition':
      return `setPosition ${targetLabel(a.target)} → (${a.x}, ${a.y})`
    case 'setVelocity':
      return `setVelocity ${targetLabel(a.target)} → (${a.vx}, ${a.vy})`
    case 'playSound':
      return `playSound "${a.path || '?'}"`
    case 'playMusic':
      return `playMusic "${a.path || '?'}"${a.loop ? ' (loop)' : ''}`
    case 'stopAllAudio':
      return 'stopAllAudio'
    case 'destroyEntity':
      return `destroyEntity ${targetLabel(a.target)}`
    case 'spawnEntity': {
      const at = a.imagePoint
        ? ` @ point "${a.imagePoint}"`
        : ` @ (${a.x}, ${a.y})`
      const flip = a.inheritFlip ? ' · inheritFlip' : ''
      return `spawnEntity "${a.className || '?'}"${at}${flip}`
    }
    case 'moveInDirection':
      return `moveInDirection ${targetLabel(a.target)} · ${a.direction} @ ${a.speed}`
    case 'setGlobalState':
      return `setGlobalState ${a.key} = ${a.value}`
    case 'emitEvent':
      return `emitEvent "${a.name || '?'}"${a.payloadKey ? ` { ${a.payloadKey} = ${a.payloadValue} }` : ''}`
    case 'toggleLogicEvent':
      return `toggleLogicEvent "${a.eventId || '?'}" → ${a.enabled ? 'on' : 'off'}`
    case 'applyImpulse':
      return `applyImpulse ${targetLabel(a.target)} (${a.ix}, ${a.iy})`
    case 'applyForce':
      return `applyForce ${targetLabel(a.target)} (${a.fx}, ${a.fy})`
    case 'setRotation':
      return `setRotation ${targetLabel(a.target)} → ${a.angle}`
    case 'setScale':
      return `setScale ${targetLabel(a.target)} → (${a.scaleX}, ${a.scaleY})`
    case 'setVisible':
      return `setVisible ${targetLabel(a.target)} → ${a.visible}`
    case 'setColorTint':
      return `setColorTint ${targetLabel(a.target)} ${a.hexColor}`
    case 'loadScene':
      return `loadScene "${a.sceneName || '?'}"${a.fadeSeconds ? ` fade ${a.fadeSeconds}s` : ''}`
    case 'restartScene':
      return 'restartScene'
    case 'setCameraTarget':
      return `setCameraTarget ${targetLabel(a.target)}`
    case 'debugLog':
      return `debugLog "${a.message}"`
    case 'wait':
      return a.then?.length
        ? `wait ${a.seconds}s (then: ${a.then.length} action(s))`
        : `wait ${a.seconds}s`
    case 'moveByOffset':
      return `moveByOffset ${targetLabel(a.target)} (${a.dx}, ${a.dy})`
    case 'snapToGrid':
      return `snapToGrid ${targetLabel(a.target)} · ${a.cellSize}px`
    case 'setEntityShader':
      return `shader ${a.shader} → ${targetLabel(a.target)}`
    case 'setScreenShader':
      return `screen shader ${a.shader}`
  }
}

export function targetLabel(t: TargetSelector): string {
  if (t === 'self' || t === 'other') return t
  if ('entityId' in t) return `#${t.entityId}`
  if ('className' in t) return `${t.className}[1]`
  return '?'
}

export function eventTitle(e: LogicEvent): string {
  return triggerSummary(e.trigger)
}
