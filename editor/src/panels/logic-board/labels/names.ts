import type {
  LogicActionType,
  LogicCondition,
  LogicTriggerType,
} from '../../../types/logic-board'

const TRIGGER_NAMES: Record<LogicTriggerType, string> = {
  onStart: 'Game starts',
  onSpawn: 'Object is created',
  onUpdate: 'Every frame',
  onCollision: 'While touching object',
  onCollisionEnter: 'Starts touching object',
  onCollisionExit: 'Stops touching object',
  onTriggerEnter: 'Enters trigger zone',
  onTriggerExit: 'Leaves trigger zone',
  onAnimationEnd: 'Animation finishes',
  onDestroy: 'Object is destroyed',
  onInput: 'Keyboard key',
  onMouseInput: 'Mouse button',
  onMessage: 'Message is received',
  onTimer: 'Timer fires',
}

const ACTION_NAMES: Record<LogicActionType, string> = {
  setVariable: 'Set score or variable',
  addVariable: 'Add to variable',
  setPosition: 'Move to position',
  setVelocity: 'Set speed',
  playSound: 'Play sound',
  playMusic: 'Play music',
  stopAllAudio: 'Stop all audio',
  stopMusic: 'Stop music',
  pauseMusic: 'Pause music',
  resumeMusic: 'Resume music',
  destroyEntity: 'Destroy',
  spawnEntity: 'Create object',
  moveInDirection: 'Move in direction',
  controllerMovement: 'Movement',
  moveController: 'Start controller movement',
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
  emitEvent: 'Send message',
  toggleLogicEvent: 'Turn rule on/off',
  applyImpulse: 'Jump or push',
  applyForce: 'Push steadily',
  setRotation: 'Rotate',
  setScale: 'Resize',
  playAnimation: 'Play animation',
  setFlip: 'Flip',
  setVisible: 'Show or hide',
  setColorTint: 'Change color',
  loadScene: 'Load level',
  restartScene: 'Restart level',
  setCameraTarget: 'Camera follows',
  cameraShake: 'Camera shake',
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
