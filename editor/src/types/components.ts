// ---------------------------------------------------------------------------
// ECS gameplay components (Scene Editor — Phase A).
//
// Strongly-typed component shapes attached to EntityDef as optional fields
// (same pattern the codebase already uses for `physics` / `animation`).
// The visual Inspector is driven by panels/inspector/component-registry.ts,
// which references these types — no `any`, full autocomplete + validation.
//
// These fields are consumed by the native and WASM runtimes through
// RuntimeEntityGateway; keep TypeScript, JSON parsing, C++ structs and the
// Inspector registry aligned when adding or changing a component.
// ---------------------------------------------------------------------------

export type CollisionShapeType = 'rectangle' | 'circle' | 'capsule' | 'polygon'
export type CollisionResponse = 'solid' | 'sensor'
export type CollisionShapeRole = 'body' | 'feet' | 'hurtbox' | 'hitbox' | 'interaction'
export type CollisionBodyType = 'static' | 'kinematic' | 'dynamic'

export interface CollisionShapePoint {
  x: number
  y: number
}

export interface CollisionShapeDef {
  type: CollisionShapeType
  response: CollisionResponse
  role: CollisionShapeRole
  layerId: string
  maskLayerIds: string[]
  offsetX: number
  offsetY: number
  width: number
  height: number
  radius: number
  points?: CollisionShapePoint[]
  enabled: boolean
  oneWay: boolean
  friction: number
  restitution: number
  density: number
}

export interface CollisionBodyComponent {
  bodyType: CollisionBodyType
  enabled: boolean
  /** When set, runtime resolves shapes from project.collisionProfiles[profileId]. */
  profileId?: string
  /** Inline shapes for non-sprite bodies (platforms). Ignored when profileId resolves. */
  shapes: CollisionShapeDef[]
}

/** Arcade kinematic platformer movement (coyote time, jump buffer, …). */
export interface PlatformerControllerComponent {
  maxSpeed:      number      // px/s
  jumpForce:     number      // px/s impulse
  customGravity: number      // px/s^2 (overrides world gravity)
  coyoteTime:    number      // s — grace after leaving ground
  jumpBuffer:    number      // s — early jump-press tolerance
  climbSpeed:    number      // px/s vertical speed while climbing
}

/** Arcade top-down movement driven by movement intents. */
export interface TopDownControllerComponent {
  maxSpeed:       number      // px/s
  acceleration:   number      // px/s^2
  friction:       number      // px/s^2 applied when no movement intent
  fourDirections: boolean     // constrain movement to one axis
}

/** Constant linear motion for bullets, moving hazards, and simple movers. */
export interface LinearMoverComponent {
  directionX: number          // normalized by runtime
  directionY: number          // normalized by runtime
  speed:      number          // px/s
}

/** 2D camera follow target with offset and smoothing (Renderer). */
export interface CameraTargetComponent {
  offsetX:     number          // world px added to entity position
  offsetY:     number
  followSpeed: number          // exponential lerp rate (1/s); 0 = snap
}

/** Pulls tagged entities toward this entity (loot magnet on player). */
export interface MagneticItemComponent {
  attractTag: string           // tag on entities to pull (e.g. pickup)
  radius:     number           // max distance px; 0 = unlimited
  pullSpeed:  number           // px/s toward holder
}

/** Swarm AI: chase nearest target class + separate from peers. */
export interface HordeMemberComponent {
  targetClass:      string
  maxSpeed:         number
  separationRadius: number
  separationWeight: number
  chaseWeight:      number
}

/** Hit points + invulnerability window. */
export interface HealthComponent {
  maxHp:     number
  currentHp: number
  iFrames:   number          // s of invulnerability after a hit
}

/** Destroy the entity after `lifespan` seconds (0 = manual only). */
export interface AutoDestroyComponent {
  lifespan: number           // s
}

import type { TextAnchor } from '../utils/text-anchor'

/** How a bound numeric value (or Set Text value) is rendered as a string. */
export type TextFormat =
  | 'text'      // raw value, integers print without a trailing .0
  | 'integer'   // rounded to a whole number
  | 'padded'    // zero-padded integer to `digits` places (e.g. 000120)
  | 'time'      // seconds → m:ss
  | 'percent'   // rounded integer + "%"
  | 'decimals'  // fixed `digits` decimal places

/** Text label (score, titles, hints) rendered above the entity sprite. */
export interface TextComponent {
  text:     string
  /** When set, the runtime auto-updates the label each frame from this declared
   *  variable (no onUpdate rule needed). Empty = static `text`. */
  bindKey:  string
  bindScope?: 'global' | 'local'
  format:   TextFormat                  // applied to the bound value
  digits:   number                      // pad width (padded) / decimal places (decimals)
  prefix:   string                      // shown before the bound value
  suffix:   string                      // shown after the bound value
  fontPath: string                      // project-relative (assets/fonts/x.ttf); '' = engine default
  size:     number                      // px
  colorHex: string                      // #rrggbb
  align:    TextAnchor              // 3×3 anchor point at the entity position
  offsetX:  number                      // px from entity position
  offsetY:  number
  /** Draw fixed on screen (HUD) instead of in the world (scrolls with camera). */
  screenSpace: boolean
}

/** Filled bar driven by a variable (health, mana, progress, loading). */
export interface GaugeComponent {
  bindKey:      string                  // variable read as the current value
  bindScope?:   'global' | 'local'
  maxValue:     number                  // value mapped to a full bar
  width:        number                  // px
  height:       number                  // px
  fillColorHex: string                  // #rrggbb
  bgColorHex:   string                  // #rrggbb (track behind the fill)
  direction:    'horizontal' | 'vertical'
  offsetX:      number                  // px from entity position
  offsetY:      number
  /** Draw fixed on screen (HUD) instead of in the world. */
  screenSpace:  boolean
}

/** Talkable NPC — references `dialogs/{dialogId}.json` in the project folder. */
export interface DialogComponent {
  dialogId: string
  startNode?: string
  textSpeed?: number
  triggerMessage?: string
}

/**
 * The set of optional ECS components an entity can carry, keyed by the field
 * name used on EntityDef. `physics`/`animation` already live on EntityDef and
 * are surfaced through the same registry without duplicating their types.
 */
export interface EntityComponents {
  collisionBody?:        CollisionBodyComponent
  platformerController?: PlatformerControllerComponent
  topDownController?:    TopDownControllerComponent
  linearMover?:          LinearMoverComponent
  cameraTarget?:         CameraTargetComponent
  magneticItem?:         MagneticItemComponent
  hordeMember?:          HordeMemberComponent
  health?:               HealthComponent
  autoDestroy?:          AutoDestroyComponent
  dialog?:               DialogComponent
  text?:                 TextComponent
  gauge?:                GaugeComponent
}

export type ComponentKey = keyof EntityComponents

/** Runtime list of optional component field names (parse/serialize). */
export const COMPONENT_KEYS: ComponentKey[] = [
  'collisionBody', 'platformerController', 'topDownController', 'linearMover',
  'cameraTarget', 'magneticItem', 'hordeMember', 'health', 'autoDestroy', 'dialog',
  'text', 'gauge',
]
