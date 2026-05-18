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

export const TRIGGER_TYPES: LogicTriggerType[] = [
  'onStart',
  'onUpdate',
  'onCollision',
  'onInput',
  'onTimer',
]

export const ACTION_TYPES: LogicActionType[] = [
  'setVariable',
  'addVariable',
  'setPosition',
  'setVelocity',
  'playSound',
  'playMusic',
  'stopAllAudio',
  'destroyEntity',
  'spawnEntity',
  'setGlobalState',
  'emitEvent',
  'debugLog',
]

export const CONDITION_TYPES = [
  'compareVariable',
  'compareClass',
  'isKeyDown',
  'chance',
] as const

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
    case 'onInput':
      return { type: 'onInput', keyCode: 'Space', eventType: 'pressed' }
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
    case 'chance':
      return { type: 'chance', percent: 50 }
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
      return { type: 'spawnEntity', className: '', x: 0, y: 0 }
    case 'setGlobalState':
      return { type: 'setGlobalState', key: 'level', value: 1 }
    case 'emitEvent':
      return { type: 'emitEvent', name: 'my_event', payloadKey: '', payloadValue: '' }
    case 'debugLog':
      return { type: 'debugLog', message: '' }
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
    case 'onInput':
      return `onInput · key "${t.keyCode}" · ${t.eventType}`
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
    case 'chance':
      return `chance ${c.percent}%`
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
    case 'spawnEntity':
      return `spawnEntity "${a.className || '?'}" @ (${a.x}, ${a.y})`
    case 'setGlobalState':
      return `setGlobalState ${a.key} = ${a.value}`
    case 'emitEvent':
      return `emitEvent "${a.name || '?'}"${a.payloadKey ? ` { ${a.payloadKey} = ${a.payloadValue} }` : ''}`
    case 'debugLog':
      return `debugLog "${a.message}"`
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
