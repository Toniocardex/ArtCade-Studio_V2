// ---------------------------------------------------------------------------
// ECS gameplay components (Scene Editor — Phase A).
//
// Strongly-typed component shapes attached to EntityDef as optional fields
// (same pattern the codebase already uses for `physics` / `animation`).
// The visual Inspector is driven by panels/inspector/component-registry.ts,
// which references these types — no `any`, full autocomplete + validation.
//
// NOTE: the C++ runtime does not yet consume these (arrives in Phase D);
// until then they are authored/persisted in the editor and ignored by the
// engine — no regression for projects that don't use them.
// ---------------------------------------------------------------------------

/** Physics trigger volume — fires when a tagged entity enters its area. */
export interface SensorComponent {
  shape:     'Circle' | 'Rectangle'
  radius:    number          // px (Circle)
  width:     number          // px (Rectangle)
  height:    number          // px (Rectangle)
  targetTag: string          // only entities with this tag trigger it
}

/** Platform surface kind (Construct-style Solid vs Jump-thru). */
export type SolidSurfaceKind = 'solid' | 'oneWay'

/** Static / one-way surface for platformer grounding (AABB resolve; not a physics body by itself). */
export interface SolidComponent {
  groundClass: string
  /** Default `solid` when omitted (legacy projects). */
  surfaceKind?: SolidSurfaceKind
}

/** Arcade kinematic platformer movement (coyote time, jump buffer, …). */
export interface PlatformerControllerComponent {
  maxSpeed:      number      // px/s
  jumpForce:     number      // px/s impulse
  customGravity: number      // px/s^2 (overrides world gravity)
  coyoteTime:    number      // s — grace after leaving ground
  jumpBuffer:    number      // s — early jump-press tolerance
  groundClass:   string      // Solid / overlap class for isGrounded
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

/**
 * The set of optional ECS components an entity can carry, keyed by the field
 * name used on EntityDef. `physics`/`animation` already live on EntityDef and
 * are surfaced through the same registry without duplicating their types.
 */
export interface EntityComponents {
  sensor?:               SensorComponent
  solid?:                SolidComponent
  platformerController?: PlatformerControllerComponent
  topDownController?:    TopDownControllerComponent
  linearMover?:          LinearMoverComponent
  cameraTarget?:         CameraTargetComponent
  magneticItem?:         MagneticItemComponent
  hordeMember?:          HordeMemberComponent
  health?:               HealthComponent
  autoDestroy?:          AutoDestroyComponent
}

export type ComponentKey = keyof EntityComponents

/** Runtime list of optional component field names (parse/serialize). */
export const COMPONENT_KEYS: ComponentKey[] = [
  'sensor', 'solid', 'platformerController', 'topDownController', 'linearMover',
  'cameraTarget', 'magneticItem', 'hordeMember', 'health', 'autoDestroy',
]
