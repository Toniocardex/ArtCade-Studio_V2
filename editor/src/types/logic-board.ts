// ---------------------------------------------------------------------------
// Logic Board — visual game-logic authoring model
//
// Terminology (see docs/LOGIC_BOARD_SPEC.md Part I):
//   • Logic Board     — authoring environment (a "work sheet" of logic)
//   • Logic Event     — a conditional block: trigger + conditions + actions
//   • Logic Component — an atomic brick (a Trigger, a Condition or an Action)
//                        NOT to be confused with an ECS Component (data).
//
// The runtime never parses this JSON: the editor compiles it to Lua event
// handlers plus a compatibility `tick(dt)` when polling is required. The API
// surface used by the generated Lua is the real dot-notation prelude exposed
// by runtime-cpp/src/modules/game-api/src/*.cpp.
//
// This MVP only models Logic Components backed by an existing runtime API.
// ---------------------------------------------------------------------------

export type ComparisonOp = '==' | '!=' | '<' | '<=' | '>' | '>='

/** Which entities an action targets. */
export type TargetSelector =
  | 'self'                                  // the current entity in the board's target pool
  | 'other'                                 // the entity collided with (onCollision only)
  | { entityId: number }                    // a specific entity id
  | { className: string; first: boolean }   // a class pool (first → first match)

export type LogicPrimitive = number | string | boolean

export type LogicComponentValueProperty =
  | 'platformer.maxSpeed'
  | 'platformer.jumpForce'
  | 'platformer.customGravity'
  | 'platformer.coyoteTime'
  | 'platformer.jumpBuffer'
  | 'platformer.grounded'
  | 'topDown.maxSpeed'
  | 'topDown.acceleration'
  | 'topDown.friction'
  | 'topDown.fourDirections'
  | 'linearMover.directionX'
  | 'linearMover.directionY'
  | 'linearMover.speed'
  | 'linearMover.paused'
  | 'cameraTarget.offsetX'
  | 'cameraTarget.offsetY'
  | 'cameraTarget.followSpeed'
  | 'magnet.enabled'
  | 'magnet.attractTag'
  | 'magnet.radius'
  | 'magnet.pullSpeed'
  | 'horde.targetClass'
  | 'horde.maxSpeed'
  | 'horde.separationRadius'
  | 'horde.separationWeight'
  | 'horde.chaseWeight'
  | 'autoDestroy.lifespan'
  | 'autoDestroy.elapsed'
  | 'autoDestroy.remaining'
  | 'sensor.targetTag'
  | 'solid.groundClass'
  | 'solid.surfaceKind'

export type LogicValueAtom =
  | LogicPrimitive
  | { source: 'state'; key: string; fallback?: LogicPrimitive }
  | {
      source: 'entity'
      target: TargetSelector
      property: 'positionX' | 'positionY' | 'velocityX' | 'velocityY' | 'speed' | 'healthCurrent' | 'healthMax'
    }
  | {
      source: 'component'
      target: TargetSelector
      property: LogicComponentValueProperty
      fallback?: LogicPrimitive
    }
  | { source: 'message'; key: string; fallback?: LogicPrimitive }
  | { source: 'random'; min: number; max: number }

export type LogicExpressionOperator =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'modulo'
  | 'min'
  | 'max'
  | 'power'

export interface LogicExpressionOperation {
  operator: LogicExpressionOperator
  value: LogicValueAtom
}

export interface LogicExpression {
  source: 'expression'
  initial: LogicValueAtom
  operations: LogicExpressionOperation[]
}

export type LogicValueSource = Exclude<LogicValueAtom, LogicPrimitive> | LogicExpression
export type LogicValue = LogicValueAtom | LogicExpression

// ---------------------------------------------------------------------------
// Triggers — WHEN the event is evaluated
// ---------------------------------------------------------------------------

export type LogicTrigger =
  | { type: 'onStart' }                                             // once, in init()
  // className is derived from the board's target (entity_class/entity_id+lookup);
  // a separate trigger.className would create a confusing second source of truth.
  | { type: 'onSpawn' }                                             // lifecycle.onSpawn
  | { type: 'onUpdate' }                                            // every tick(dt)
  | { type: 'onCollision'; withClass: string }                      // level-triggered (every frame while touching)
  | { type: 'onCollisionEnter'; withClass: string }                 // edge: started touching this frame
  | { type: 'onCollisionExit'; withClass: string }                  // edge: stopped touching this frame
  | { type: 'onTriggerEnter'; withClass: string }                   // edge: started touching
  | { type: 'onTriggerExit'; withClass: string }                    // edge: stopped touching
  | { type: 'onAnimationEnd'; clipName?: string }
  | { type: 'onDestroy' }                                           // lifecycle.onDestroy
  | {
      type: 'onInput'
      keyCode: string
      /** Additional keys combined with primary via keyCombine (default OR). */
      alternateKeyCodes?: string[]
      /** OR = any key; AND = all keys together; NOT = none of these keys. */
      keyCombine?: 'OR' | 'AND' | 'NOT'
      eventType: 'pressed' | 'down' | 'released'
    }
  | { type: 'onMouseInput'; button: 'left' | 'right'; eventType: 'pressed' | 'down' | 'released' }
  | { type: 'onObjectClick'; button: 'left' | 'right'; radius?: number }
  | { type: 'onObjectHoverEnter'; radius?: number }
  | { type: 'onObjectHoverExit'; radius?: number }
  | { type: 'onMessage'; messageName: string }                      // event.on listener
  | { type: 'onTimer'; seconds: number; repeat: boolean }
  | { type: 'onHealthDepleted' }                                    // edge: HP drops to ≤ 0 for the first time
  | { type: 'onDamaged' }                                           // edge: HP decreased since last frame (a hit landed)

export type LogicTriggerType = LogicTrigger['type']

// ---------------------------------------------------------------------------
// Conditions — IF the event proceeds (MVP: only runtime-backed predicates)
// ---------------------------------------------------------------------------

/** Optional per-check inversion in flat Also require… (Pass / NOT dropdown). */
export type LogicConditionNegation = { negated?: boolean }

export type LogicCondition =
  | { type: 'compareClass'; className: string }                     // collision.touchingClass
  | { type: 'compareVariable'; key: string; operator: ComparisonOp; value: LogicValue }
  | { type: 'compareValues'; left: LogicValue; operator: ComparisonOp; right: LogicValue }
  | { type: 'isKeyDown'; keyCode: string }                          // input.isKeyDown
  | { type: 'hasTag'; tag: string }                                 // self has object tag
  | { type: 'compareDistance'; target: TargetSelector; operator: ComparisonOp; value: number }
  | { type: 'isMouseOver'; radius?: number }                        // cursor near self
  | { type: 'raycastHit'; dirX: number; dirY: number; length: number; className?: string }
  | { type: 'chance'; percent: LogicValue }
  | { type: 'isTileAreaFree'; x: LogicValue; y: LogicValue; w: LogicValue; h: LogicValue }
  | { type: 'isSpaceFree'; x: LogicValue; y: LogicValue; w: LogicValue; h: LogicValue }
  | { type: 'compareHealth'; target: TargetSelector; field: 'current' | 'max'; operator: ComparisonOp; value: LogicValue }
  | { type: 'isPlatformerGrounded'; target: TargetSelector }
  | { type: 'compareCount'; className: string; operator: ComparisonOp; value: LogicValue }   // pool.count
  | { type: 'entityExists'; target: TargetSelector }                                      // object.exists
  | { type: 'compareVelocity'; target: TargetSelector; axis: 'x' | 'y' | 'magnitude'; operator: ComparisonOp; value: LogicValue }
  | { type: 'comparePosition'; target: TargetSelector; axis: 'x' | 'y'; operator: ComparisonOp; value: LogicValue }
  | { type: 'saveExists'; slot: string }                                                   // save.exists
  | { type: 'isDialogActive' }
  | { type: 'isMusicPlaying' }                                      // audio.isMusicPlaying

/**
 * Boolean tree for AND/OR/nested conditions (docs/LOGIC_BOARD_CONDITIONAL_DESIGN.md).
 * A flat `LogicCondition[]` on an event is sugar for an AND group of leaves.
 */
export type LogicConditionEntry = LogicCondition & LogicConditionNegation

export type LogicConditionNode =
  | { kind: 'leaf'; condition: LogicCondition; negated?: boolean }
  | { kind: 'group'; operator: 'AND' | 'OR' | 'NOT'; statements: LogicConditionNode[] }

// ---------------------------------------------------------------------------
// Actions — WHAT the event does (MVP: only runtime-backed actions)
// ---------------------------------------------------------------------------

export type LogicAction =
  | { type: 'setVariable'; key: string; value: LogicValue }
  | { type: 'addVariable'; key: string; amount: LogicValue }
  | { type: 'setPosition'; target: TargetSelector; x: LogicValue; y: LogicValue }
  | { type: 'setVelocity'; target: TargetSelector; vx: LogicValue; vy: LogicValue }
  | { type: 'playSound'; path?: string; audioAssetId?: string; volume?: number; pitch?: number }
  | { type: 'playMusic'; path?: string; audioAssetId?: string; loop?: boolean }
  | { type: 'stopAllAudio' }
  | { type: 'stopMusic' }
  | { type: 'pauseMusic' }
  | { type: 'resumeMusic' }
  | { type: 'setMusicVolume'; volume: LogicValue }
  | { type: 'setMasterVolume'; volume: LogicValue }
  | { type: 'setSfxVolume'; volume: LogicValue }
  | { type: 'fadeMusic'; volume: LogicValue; seconds: LogicValue }
  | { type: 'destroyEntity'; target: TargetSelector }
  | {
      type: 'clickToDestroy'
      button: 'left' | 'right'
      radius?: number
    }
  | {
      type: 'spawnEntity'
      className: string
      x: number
      y: number
      inheritFlip?: boolean
      /** Spawn at a named point on self's sprite asset (overrides x,y when set). */
      imagePoint?: string
    }
  | {
      type: 'spawnEntityAtPointer'
      className: string
    }
  | {
      type: 'moveInDirection'
      target: TargetSelector
      direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward'
      speed: number
    }
  | { type: 'controllerMovement'; target: TargetSelector; direction: 'left' | 'right' | 'up' | 'down' }
  | { type: 'moveController'; target: TargetSelector; direction: 'left' | 'right' | 'up' | 'down' | 'stop' }
  | { type: 'clearMovementIntent'; target: TargetSelector }
  | { type: 'requestPlatformerJump'; target: TargetSelector }
  | { type: 'setPlatformerMaxSpeed'; target: TargetSelector; speed: LogicValue }
  | { type: 'setPlatformerJumpForce'; target: TargetSelector; force: LogicValue }
  | { type: 'setPlatformerGravity'; target: TargetSelector; gravity: LogicValue }
  | { type: 'setTopDownMaxSpeed'; target: TargetSelector; speed: LogicValue }
  | { type: 'setTopDownAcceleration'; target: TargetSelector; acceleration: LogicValue }
  | { type: 'setTopDownFriction'; target: TargetSelector; friction: LogicValue }
  | { type: 'setTopDownFourDirections'; target: TargetSelector; enabled: boolean }
  | { type: 'damageEntity'; target: TargetSelector; amount: LogicValue }
  | { type: 'healEntity'; target: TargetSelector; amount: LogicValue }
  | { type: 'setEntityHealth'; target: TargetSelector; currentHp: LogicValue; maxHp?: LogicValue }
  | { type: 'setLinearMoverDirection'; target: TargetSelector; directionX: LogicValue; directionY: LogicValue }
  | { type: 'setLinearMoverSpeed'; target: TargetSelector; speed: LogicValue }
  | { type: 'pauseLinearMover'; target: TargetSelector }
  | { type: 'resumeLinearMover'; target: TargetSelector }
  | { type: 'setMagnetEnabled'; target: TargetSelector; enabled: boolean }
  | { type: 'setMagnetTargetTag'; target: TargetSelector; tag: string }
  | { type: 'setMagnetRadius'; target: TargetSelector; radius: LogicValue }
  | { type: 'setMagnetPullSpeed'; target: TargetSelector; speed: LogicValue }
  | { type: 'setHordeTargetClass'; target: TargetSelector; className: string }
  | { type: 'setHordeWeights'; target: TargetSelector; chaseWeight: LogicValue; separationWeight: LogicValue }
  | { type: 'setHordeMaxSpeed'; target: TargetSelector; speed: LogicValue }
  | { type: 'setHordeSeparationRadius'; target: TargetSelector; radius: LogicValue }
  | { type: 'setAutoDestroyLifespan'; target: TargetSelector; lifespan: LogicValue }
  | { type: 'cancelAutoDestroy'; target: TargetSelector }
  | { type: 'emitEvent'; name: string; payloadKey?: string; payloadValue?: number | string | boolean }
  | { type: 'startDialog'; target: TargetSelector; dialogId: string }
  | { type: 'endDialog' }
  | { type: 'toggleLogicEvent'; eventId: string; enabled: boolean }
  | { type: 'applyImpulse'; target: TargetSelector; ix: number; iy: number }
  | { type: 'applyForce'; target: TargetSelector; fx: number; fy: number }
  | { type: 'setRotation'; target: TargetSelector; angle: number }
  | { type: 'setScale'; target: TargetSelector; scaleX: number; scaleY: number }
  | { type: 'playAnimation'; target: TargetSelector; clipName: string }
  | { type: 'setFlip'; target: TargetSelector; flipX: boolean; flipY?: boolean }
  | { type: 'setVisible'; target: TargetSelector; visible: boolean }
  | { type: 'setColorTint'; target: TargetSelector; hexColor: string; alpha?: number }
  | { type: 'loadScene'; sceneName: string; fadeSeconds?: number }
  | { type: 'restartScene' }
  | { type: 'centerCameraOn'; target: TargetSelector }
  | { type: 'followCamera'; target: TargetSelector }
  | { type: 'stopCameraFollow' }
  | { type: 'useDefaultCameraTarget' }
  | { type: 'setCameraTarget'; target: TargetSelector }
  | { type: 'cameraShake'; trauma: number; durationSeconds?: number }
  | { type: 'debugLog'; message: string }
  /** Pauses the action sequence; following actions run inside time.delay (or use `then`). */
  | { type: 'wait'; seconds: number; then?: LogicAction[] }
  /**
   * Runs a block of actions `count` times, then continues with any actions listed after
   * this one. If `actions` is set, only that list is repeated; otherwise the following
   * linear actions (until the next Wait / Repeat) form the body.
   */
  | { type: 'repeatTimes'; count: number; intervalSeconds?: number; actions?: LogicAction[] }
  | { type: 'moveByOffset'; target: TargetSelector; dx: number; dy: number }
  | { type: 'snapToGrid'; target: TargetSelector; cellSize: number }
  | { type: 'setEntityShader'; target: TargetSelector; shader: string }
  | { type: 'setScreenShader'; shader: string }
  // ── State math ────────────────────────────────────────────────────────────
  | { type: 'setVariableRandomRange'; key: string; min: number; max: number }
  | { type: 'clampVariable'; key: string; min: number; max: number }
  | { type: 'multiplyVariable'; key: string; factor: number }
  // ── Save / Load ───────────────────────────────────────────────────────────
  | { type: 'saveVariable'; slot: string; key: string }
  | { type: 'loadVariable'; slot: string; key: string }
  | { type: 'deleteSave'; slot: string }
  // ── Camera ────────────────────────────────────────────────────────────────
  | { type: 'setCameraZoom'; zoom: number }
  | { type: 'panCamera'; dx: number; dy: number }
  | { type: 'setCameraPosition'; x: number; y: number }
  // ── Time ──────────────────────────────────────────────────────────────────
  | { type: 'setTimeScale'; scale: number }
  // ── Entity helpers ────────────────────────────────────────────────────────
  | { type: 'spawnAtEntity'; className: string; target: TargetSelector }
  | { type: 'moveToward'; target: TargetSelector; toward: TargetSelector; speed: number }
  | { type: 'lookAtTarget'; target: TargetSelector; toward: TargetSelector }

export type LogicActionType = LogicAction['type']

// ---------------------------------------------------------------------------
// Logic Event / Logic Board / document
// ---------------------------------------------------------------------------

export interface LogicEvent {
  id:          string                 // stable id for editor undo/redo
  enabled:     boolean
  trigger:     LogicTrigger
  /** Explicit UI/runtime gate for the optional condition section. */
  onlyIfEnabled?: boolean
  /** Flat list combine mode when `conditionRoot` is absent (default AND). */
  conditionsOperator?: 'AND' | 'OR' | 'NOT'
  /** Flat list of leaves. Use `conditionRoot` for nested AND/OR/NOT trees. */
  conditions?: LogicConditionEntry[]
  conditionRoot?: LogicConditionNode
  actions:     LogicAction[]
  /** Optional Else branch when Also require… checks fail (requires conditions). */
  elseEnabled?: boolean
  elseActions?: LogicAction[]
}

export interface LogicBoard {
  boardId: string                     // e.g. "player_controller"
  name?: string                       // human-readable label shown in UI / Lua comments
  target: {
    /**
     * Defines what `self` means for this board's events.
     *   • object_type — iterate every live instance of `objectTypeId` each tick
     *   • global      — no entity context; for triggers that fire scene-wide
     *                   (input, mouse, message, global timers). `self` is nil
     *                   in the generated Lua, so actions targeting self are
     *                   rejected by the validator for global boards.
     *   • scene       — reserved/legacy; treated as global.
     */
    type:        'object_type' | 'global' | 'scene'
    objectTypeId?: string             // required when type === 'object_type'
  }
  events: LogicEvent[]
}

/** Persisted inside ProjectDoc as `logicBoards`. */
export type LogicBoardDoc = LogicBoard[]

/** Non-fatal issues found while parsing boards from disk (events are preserved). */
export interface LogicBoardLoadIssue {
  boardId: string
  eventIndex: number
  errors: string[]
}
