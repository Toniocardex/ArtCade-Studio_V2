import type {
  LogicActionType,
  LogicCondition,
  LogicTriggerType,
} from '../../../types/logic-board'

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
  moveController: 'Move controller',
  setMovementIntent: 'Move with controller',
  clearMovementIntent: 'Stop controller movement',
  requestPlatformerJump: 'Platformer jump',
  damageEntity: 'Damage',
  healEntity: 'Heal',
  setEntityHealth: 'Set health',
  setLinearMoverDirection: 'Linear mover direction',
  setLinearMoverSpeed: 'Linear mover speed',
  pauseLinearMover: 'Pause linear mover',
  resumeLinearMover: 'Resume linear mover',
  setMagnetEnabled: 'Magnet on/off',
  setMagnetTargetTag: 'Magnet tag',
  setHordeTargetClass: 'Horde chase class',
  setHordeWeights: 'Horde weights',
  setAutoDestroyLifespan: 'Auto destroy timer',
  cancelAutoDestroy: 'Cancel auto destroy',
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
  compareHealth: 'Health check',
  isPlatformerGrounded: 'On ground',
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
