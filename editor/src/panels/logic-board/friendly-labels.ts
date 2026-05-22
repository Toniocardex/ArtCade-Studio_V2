// ---------------------------------------------------------------------------
// Plain-English UI copy for Logic Board (display only — types/compiler unchanged)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../../types'
import type {
  LogicAction,
  LogicActionType,
  LogicBoard,
  LogicCondition,
  LogicConditionNode,
  LogicEvent,
  LogicTrigger,
  LogicTriggerType,
  TargetSelector,
} from '../../types/logic-board'
import {
  classDisplayLabel,
  entityIdDisplayLabel,
  logicBoardLabel,
} from '../../utils/project'
import { formatKeyLabel } from '../../components/logic-board/KeyCapture'
import { getComponentMeta, type ComponentKind } from '../../utils/logic-board/schema-registry'
import {
  getTriggerExecutionMode,
  usesTickFallback,
} from '../../utils/logic-board/trigger-execution'

const TRIGGER_NAMES: Record<LogicTriggerType, string> = {
  onStart: 'Game starts',
  onSpawn: 'Object spawns',
  onUpdate: 'Every frame (polling)',
  onCollision: 'Touches something (polling)',
  onTriggerEnter: 'Enters a zone',
  onTriggerExit: 'Leaves a zone',
  onAnimationEnd: 'Animation finishes',
  onDestroy: 'Is destroyed',
  onInput: 'Keyboard input',
  onMouseInput: 'Mouse on object (polling)',
  onMessage: 'Message received',
  onTimer: 'Timer',
}

const ACTION_NAMES: Record<LogicActionType, string> = {
  setVariable: 'Set score or variable',
  addVariable: 'Add to variable',
  setPosition: 'Move to position',
  setVelocity: 'Set speed',
  playSound: 'Play sound',
  playMusic: 'Play music',
  stopAllAudio: 'Stop all audio',
  destroyEntity: 'Destroy',
  spawnEntity: 'Create object',
  moveInDirection: 'Move in direction',
  setGlobalState: 'Set global value',
  emitEvent: 'Send message',
  toggleLogicEvent: 'Turn rule on/off',
  applyImpulse: 'Jump or push',
  applyForce: 'Push steadily',
  setRotation: 'Rotate',
  setScale: 'Resize',
  setVisible: 'Show or hide',
  setColorTint: 'Change color',
  loadScene: 'Load level',
  restartScene: 'Restart level',
  setCameraTarget: 'Camera follows',
  debugLog: 'Debug message',
  wait: 'Wait',
  moveByOffset: 'Step by pixels',
  snapToGrid: 'Snap to grid',
  setEntityShader: 'Visual effect on object',
  setScreenShader: 'Screen effect',
}

const CONDITION_NAMES: Record<LogicCondition['type'], string> = {
  compareVariable: 'Variable check',
  compareClass: 'Touching type',
  isKeyDown: 'Key held',
  hasTag: 'Has tag',
  compareDistance: 'Distance check',
  isMouseOver: 'Mouse nearby',
  raycastHit: 'Line of sight',
  chance: 'Random chance',
  isSpaceFree: 'Area is empty',
}

const FIELD_LABELS: Record<string, string> = {
  'trigger:onCollision:withClass': 'Touching class',
  'trigger:onTriggerEnter:withClass': 'Zone tag',
  'trigger:onTriggerExit:withClass': 'Zone tag',
  'trigger:onAnimationEnd:clipName': 'Animation name',
  'trigger:onInput:keyCode': 'Key',
  'trigger:onInput:eventType': 'When',
  'trigger:onMouseInput:button': 'Button',
  'trigger:onMouseInput:eventType': 'When',
  'trigger:onMessage:messageName': 'Message name',
  'trigger:onTimer:seconds': 'Every (seconds)',
  'trigger:onTimer:repeat': 'Repeat',
  'action:spawnEntity:className': 'What to create',
  'action:spawnEntity:x': 'Horizontal position',
  'action:spawnEntity:y': 'Vertical position',
  'action:spawnEntity:inheritFlip': 'Match facing direction',
  'action:spawnEntity:imagePoint': 'Spawn at attachment point',
  'condition:compareClass:className': 'Object type',
  'condition:raycastHit:className': 'Object type (optional)',
  'action:moveInDirection:direction': 'Direction',
  'action:moveInDirection:speed': 'Speed',
  'action:loadScene:sceneName': 'Level name',
  'action:loadScene:fadeSeconds': 'Fade (seconds)',
  'condition:isSpaceFree:x': 'X',
  'condition:isSpaceFree:y': 'Y',
  'condition:isSpaceFree:w': 'Width',
  'condition:isSpaceFree:h': 'Height',
}

export function triggerDisplayName(type: LogicTriggerType): string {
  return TRIGGER_NAMES[type] ?? type
}

export function actionDisplayName(type: LogicActionType): string {
  return ACTION_NAMES[type] ?? type
}

export function conditionDisplayName(type: LogicCondition['type']): string {
  return CONDITION_NAMES[type] ?? type
}

export function triggerCategory(type: LogicTriggerType): string {
  return getComponentMeta('trigger', type)?.category ?? 'Other'
}

/** Compact badge label for collapsed rule cards (Event vs Polling). */
export function triggerExecutionBadge(
  event: LogicEvent,
  board?: LogicBoard | null,
  project?: ProjectDoc | null,
): { label: string; title: string } {
  const mode = getTriggerExecutionMode(
    event.trigger,
    board ?? undefined,
    event,
    project,
  )
  const polling = board
    ? usesTickFallback(event, board, project)
    : mode === 'polling'
  const label = polling ? 'Polling' : mode === 'hybrid' ? 'Event*' : 'Event'
  const title = polling
    ? 'This rule runs inside tick(dt) each frame or polls state.'
    : mode === 'hybrid'
      ? 'Event handler when configured; may fall back to polling.'
      : 'Registered once as an event handler (_logic_init).'
  return { label, title }
}

export function actionCategory(type: LogicActionType): string {
  return getComponentMeta('action', type)?.category ?? 'Other'
}

export function conditionCategory(type: LogicCondition['type']): string {
  return getComponentMeta('condition', type)?.category ?? 'Other'
}

export function fieldDisplayLabel(
  kind: ComponentKind,
  type: string,
  fieldName: string,
): string | undefined {
  return FIELD_LABELS[`${kind}:${type}:${fieldName}`]
}

export function enumDisplayLabel(context: string, value: string): string {
  const isDirection =
    context.includes('direction') || context.includes('moveInDirection')
  const isInputEvent =
    context.includes('eventType') || context.includes('onInput') || context.includes('onMouseInput')
  const isMouseButton = context.includes('button')

  if (isDirection) {
    const dir: Record<string, string> = {
      forward: 'Forward (facing)',
      backward: 'Backward',
      up: 'Up',
      down: 'Down',
      left: 'Left',
      right: 'Right',
    }
    if (dir[value]) return dir[value]
  }

  if (isInputEvent && !isMouseButton) {
    const input: Record<string, string> = {
      pressed: 'Just pressed',
      down: 'Held down',
      released: 'Just released',
    }
    if (input[value]) return input[value]
  }

  if (isMouseButton) {
    if (value === 'left') return 'Left mouse'
    if (value === 'right') return 'Right mouse'
  }

  const map: Record<string, string> = {
    none: 'None',
    outline: 'Outline',
    hit_flash: 'Hit flash',
    crt: 'Retro scanlines',
    scanlines: 'Scanlines',
    wave: 'Wave',
    palette_swap: 'Palette swap',
  }
  return map[value] ?? value.replace(/_/g, ' ')
}

function fmtClass(className: string, project?: ProjectDoc | null): string {
  return classDisplayLabel(project, className)
}

export function targetDisplayLabel(
  t: TargetSelector,
  project?: ProjectDoc | null,
): string {
  if (t === 'self') return 'This object'
  if (t === 'other') return 'Other object'
  if ('entityId' in t) return entityIdDisplayLabel(project, t.entityId)
  if ('className' in t) {
    const name = fmtClass(t.className, project)
    return t.first ? `First ${name}` : `Any ${name}`
  }
  return 'Target'
}

export function boardDisplayName(
  board: LogicBoard,
  project?: ProjectDoc | null,
): string {
  return logicBoardLabel(project, board)
}

export function triggerSummaryPlain(
  t: LogicTrigger,
  project?: ProjectDoc | null,
): string {
  switch (t.type) {
    case 'onStart':
      return 'When the game starts'
    case 'onSpawn':
      return t.className
        ? `When "${fmtClass(t.className, project)}" spawns`
        : 'When this object spawns'
    case 'onUpdate':
      return 'Every frame while playing'
    case 'onCollision':
      return t.withClass
        ? `When touching "${fmtClass(t.withClass, project)}"`
        : 'When touching something'
    case 'onTriggerEnter':
      return t.withClass
        ? `When entering zone "${fmtClass(t.withClass, project)}"`
        : 'When entering a zone'
    case 'onTriggerExit':
      return t.withClass
        ? `When leaving zone "${fmtClass(t.withClass, project)}"`
        : 'When leaving a zone'
    case 'onAnimationEnd':
      return t.clipName
        ? `When animation "${t.clipName}" ends`
        : 'When an animation ends'
    case 'onDestroy':
      return 'When this object is destroyed'
    case 'onInput': {
      const key = formatKeyLabel(t.keyCode)
      const when =
        t.eventType === 'pressed'
          ? 'presses'
          : t.eventType === 'released'
            ? 'releases'
            : 'holds'
      return `When player ${when} ${key}`
    }
    case 'onMouseInput': {
      const btn = t.button === 'right' ? 'right' : 'left'
      const when =
        t.eventType === 'pressed'
          ? 'clicks'
          : t.eventType === 'released'
            ? 'releases'
            : 'holds'
      return `When ${btn} mouse button ${when}`
    }
    case 'onMessage':
      return `When message "${t.messageName || '…'}" is received`
    case 'onTimer':
      return t.repeat
        ? `Every ${t.seconds} seconds (repeating)`
        : `After ${t.seconds} seconds`
  }
}

export function conditionSummaryPlain(
  c: LogicCondition,
  project?: ProjectDoc | null,
): string {
  switch (c.type) {
    case 'compareVariable':
      return `Score ${c.key} ${c.operator} ${c.value}`
    case 'compareClass':
      return `Touching "${fmtClass(c.className || '?', project)}"`
    case 'isKeyDown':
      return `${formatKeyLabel(c.keyCode)} is held`
    case 'hasTag':
      return `Has tag "${c.tag || '?'}"`
    case 'compareDistance':
      return `Distance to ${targetDisplayLabel(c.target, project)} ${c.operator} ${c.value}`
    case 'isMouseOver':
      return `Mouse is within ${c.radius ?? 32}px`
    case 'raycastHit':
      return c.className
        ? `Can see "${fmtClass(c.className, project)}" ahead`
        : 'Something ahead in line of sight'
    case 'chance':
      return `${c.percent}% chance`
    case 'isSpaceFree':
      return `Area (${c.x}, ${c.y}) is free`
  }
}

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
      return `Play sound "${a.path || '…'}"`
    case 'playMusic':
      return `Play music "${a.path || '…'}"${a.loop ? ' (loop)' : ''}`
    case 'stopAllAudio':
      return 'Stop all sounds'
    case 'destroyEntity':
      return `Destroy ${who}`
    case 'spawnEntity': {
      if (!a.className) return 'Create object — choose what to create'
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
    case 'setGlobalState':
      return `Set global ${a.key} to ${a.value}`
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

/** Flatten condition tree to plain chips for collapsed card. */
export function conditionsPlainList(
  event: {
    conditions?: LogicCondition[]
    conditionRoot?: LogicConditionNode
  },
  project?: ProjectDoc | null,
): string[] {
  if (event.conditionRoot) {
    return flattenConditionNode(event.conditionRoot, project)
  }
  return (event.conditions ?? []).map((c) => conditionSummaryPlain(c, project))
}

function flattenConditionNode(
  node: LogicConditionNode,
  project?: ProjectDoc | null,
): string[] {
  if (node.kind === 'leaf') return [conditionSummaryPlain(node.condition, project)]
  return node.statements.flatMap((n) => flattenConditionNode(n, project))
}
