// ---------------------------------------------------------------------------
// Logic Board — visual game-logic authoring model
//
// Terminology (see docs/LOGIC_BOARD_SPEC.md Part I):
//   • Logic Board     — authoring environment (a "work sheet" of logic)
//   • Logic Event     — a conditional block: trigger + conditions + actions
//   • Logic Component — an atomic brick (a Trigger, a Condition or an Action)
//                        NOT to be confused with an ECS Component (data).
//
// The runtime never parses this JSON: the editor compiles it to a single
// Lua `tick(dt)` entry point (see utils/logic-board/compiler.ts). The API
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

// ---------------------------------------------------------------------------
// Triggers — WHEN the event is evaluated
// ---------------------------------------------------------------------------

export type LogicTrigger =
  | { type: 'onStart' }                                             // once, in init()
  | { type: 'onUpdate' }                                            // every tick(dt)
  | { type: 'onCollision'; withClass?: string }                     // self touches a class
  | { type: 'onInput'; keyCode: string; eventType: 'pressed' | 'down' | 'released' }
  | { type: 'onMouseInput'; button: 'left' | 'right'; eventType: 'pressed' | 'down' | 'released' }
  | { type: 'onMessage'; messageName: string }                      // event.on listener
  | { type: 'onTimer'; seconds: number; repeat: boolean }

export type LogicTriggerType = LogicTrigger['type']

// ---------------------------------------------------------------------------
// Conditions — IF the event proceeds (MVP: only runtime-backed predicates)
// ---------------------------------------------------------------------------

export type LogicCondition =
  | { type: 'compareClass'; className: string }                     // collision.touchingClass
  | { type: 'compareVariable'; key: string; operator: ComparisonOp; value: number | string }
  | { type: 'isKeyDown'; keyCode: string }                          // input.isKeyDown
  | { type: 'hasTag'; tag: string }                                 // self has object tag
  | { type: 'compareDistance'; target: TargetSelector; operator: ComparisonOp; value: number }
  | { type: 'isMouseOver'; radius?: number }                        // cursor near self
  | { type: 'raycastHit'; dirX: number; dirY: number; length: number; className?: string }
  | { type: 'chance'; percent: number }                             // math.random(100) <= n

/**
 * Boolean tree for AND/OR/nested conditions (docs/LOGIC_BOARD_CONDITIONAL_DESIGN.md).
 * A flat `LogicCondition[]` on an event is sugar for an AND group of leaves.
 */
export type LogicConditionNode =
  | { kind: 'leaf'; condition: LogicCondition }
  | { kind: 'group'; operator: 'AND' | 'OR'; statements: LogicConditionNode[] }

// ---------------------------------------------------------------------------
// Actions — WHAT the event does (MVP: only runtime-backed actions)
// ---------------------------------------------------------------------------

export type LogicAction =
  | { type: 'setVariable'; key: string; value: number | string | boolean }
  | { type: 'addVariable'; key: string; amount: number }
  | { type: 'setPosition'; target: TargetSelector; x: number; y: number }
  | { type: 'setVelocity'; target: TargetSelector; vx: number; vy: number }
  | { type: 'playSound'; path: string; volume?: number; pitch?: number }
  | { type: 'playMusic'; path: string; loop?: boolean }
  | { type: 'stopAllAudio' }
  | { type: 'destroyEntity'; target: TargetSelector }
  | { type: 'spawnEntity'; className: string; x: number; y: number }
  | { type: 'setGlobalState'; key: string; value: number | string | boolean }
  | { type: 'emitEvent'; name: string; payloadKey?: string; payloadValue?: number | string | boolean }
  | { type: 'toggleLogicEvent'; eventId: string; enabled: boolean }
  | { type: 'applyImpulse'; target: TargetSelector; ix: number; iy: number }
  | { type: 'applyForce'; target: TargetSelector; fx: number; fy: number }
  | { type: 'setRotation'; target: TargetSelector; angle: number }
  | { type: 'setScale'; target: TargetSelector; scaleX: number; scaleY: number }
  | { type: 'setVisible'; target: TargetSelector; visible: boolean }
  | { type: 'setColorTint'; target: TargetSelector; hexColor: string; alpha?: number }
  | { type: 'loadScene'; sceneName: string }
  | { type: 'restartScene' }
  | { type: 'setCameraTarget'; target: TargetSelector }
  | { type: 'debugLog'; message: string }

export type LogicActionType = LogicAction['type']

// ---------------------------------------------------------------------------
// Logic Event / Logic Board / document
// ---------------------------------------------------------------------------

export interface LogicEvent {
  id:          string                 // stable id for editor undo/redo
  enabled:     boolean
  trigger:     LogicTrigger
  /** Flat list = AND of leaves. Use `conditionRoot` for OR/nested trees. */
  conditions?: LogicCondition[]
  conditionRoot?: LogicConditionNode
  actions:     LogicAction[]
}

export interface LogicBoard {
  boardId: string                     // e.g. "player_controller"
  target: {
    type:       'entity_class' | 'entity_id' | 'scene'
    className?: string                // when entity_class
    entityId?:  number                // when entity_id
  }
  events: LogicEvent[]
}

/** Persisted inside ProjectDoc as `logicBoards`. */
export type LogicBoardDoc = LogicBoard[]
