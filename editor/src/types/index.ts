// ---------------------------------------------------------------------------
// Shared types — mirrors C++ ProjectDoc / EntityDef / SceneDef structs
// ---------------------------------------------------------------------------

export * from './logic-board'
export * from './components'
export * from './tilemap-grid'
export * from './tilemap'
import type { LogicBoardDoc } from './logic-board'
import type { TileDef, TilemapLayer, TilesetAsset } from './tilemap'
import type {
  CollisionBodyComponent,
  PlatformerControllerComponent,
  TopDownControllerComponent, LinearMoverComponent,
  CameraTargetComponent,
  MagneticItemComponent,
  HordeMemberComponent,
  HealthComponent, AutoDestroyComponent, DialogComponent, TextComponent, GaugeComponent,
} from './components'

export interface PhysicsLayerDef {
  id: string
  name: string
  bit: number
  color: string
}

export type CollisionProfileCoordinateSpace = 'frame-normalized' | 'world'

export interface CollisionProfileDef {
  id: string
  name: string
  /** How shape offsets/sizes are interpreted (sprite profiles default to frame-normalized). */
  coordinateSpace?: CollisionProfileCoordinateSpace
  shapes: CollisionBodyComponent['shapes']
  perAnimation?: Record<string, CollisionBodyComponent['shapes']>
  perFrame?: Record<string, CollisionBodyComponent['shapes']>
}

/**
 * Per-layer parallax scroll factor. The layer's contents are drawn with a
 * camera offset scaled by this factor:
 *   • 1 = moves with the world (default, no parallax)
 *   • <1 = far background (scrolls slower than the camera; 0 = locked to screen)
 *   • >1 = foreground (scrolls faster than the camera)
 * Applied independently on each axis so top-down games get depth on X and Y.
 */
export interface LayerParallax {
  x: number
  y: number
}

/**
 * Optional repeating background image painted for a layer, before its entities.
 * Combined with the layer's parallax factor this produces classic scrolling
 * sky / mountains / clouds backdrops.
 */
export interface LayerBackground {
  imageId: string     // ImageAsset id; '' = no background image
  tileX:   boolean    // repeat horizontally to fill the view
  tileY:   boolean    // repeat vertically to fill the view
  scrollX: number     // constant auto-scroll speed px/s (independent of camera)
  scrollY: number
}

/** Stable identifier of a render layer (never changes; names are display-only). */
export type LayerId = string

/**
 * Global render layer — identity + display name + editor lock only. The stack
 * is stored top-to-bottom (index 0 = highest render priority). Visual props
 * (visible/opacity/parallax/background) live per-scene in {@link SceneLayerSettings}.
 */
export interface LayerDef {
  /** Stable id; references (instances, scene settings, tilemaps) use this, never the name. */
  id: LayerId
  /** Display name; rename is O(1) because nothing references it. */
  name: string
  /** Editor-only: locked layers cannot be selected or dragged on the canvas. Not used by runtime render. */
  locked?: boolean
}

/**
 * Per-scene visual overrides for a render layer, keyed by {@link LayerId}.
 * A scene only stores entries that differ from the neutral defaults
 * (visible=true, opacity=1, parallax=1:1, no background).
 */
export interface SceneLayerSettings {
  /** False hides the layer in this scene (preview/play/export). Defaults to true. */
  visible?: boolean
  /** Render alpha multiplier in [0,1]. Defaults to 1. */
  opacity?: number
  /** Parallax scroll factor; defaults to { x: 1, y: 1 } when omitted. */
  parallax?: LayerParallax
  /** Optional repeating background image drawn under this layer's entities. */
  background?: LayerBackground
}

export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }
export interface Vec4 { x: number; y: number; z: number; w: number }

export interface Transform {
  position: Vec2
  scale:    Vec2
  rotation: number   // radians (matches C++ — editor displays in degrees)
  velocity?: Vec2    // runtime-only; zero at rest
}

export interface SpriteComponent {
  spriteAssetId: string
  tint:          Vec4    // texture multiply when spriteAssetId is set
  fillColor:     Vec3    // opaque RGB placeholder when no sprite image
  alpha:         number
  /** When true (default), runtime uses ImageAsset.defaultPivot for this sprite path. */
  pivotFromAsset?: boolean
  /** Override pivot when pivotFromAsset is false; otherwise cached effective pivot. */
  pivot:         Vec2
  renderOrder:   number
  /** Clip on the assigned sheet to play when playClipOnSpawn is true. */
  defaultClip?: string
  /** If true and defaultClip is set, runtime plays that clip when the entity spawns. */
  playClipOnSpawn?: boolean
}

export interface AnimationState {
  currentAnim:   string
  currentFrame:  number
  frameDuration: number
  isPlaying:     boolean
  isLooping:     boolean
}

export type BodyType     = 'Dynamic' | 'Static' | 'Kinematic'
export type ColliderShape = 'Rectangle' | 'Circle'

export interface Collider {
  shape:   ColliderShape
  size:    Vec2          // w/h for rect, radius in x for circle
  offset:  Vec2
  density:  number
  friction: number
}

export interface PhysicsComponent {
  bodyType: BodyType
  collider: Collider
}

export type GameVariableType = 'number' | 'boolean' | 'string'
export type GameVariableValue = number | boolean | string

export interface GameVariableDefinition {
  key: string
  type: GameVariableType
  initialValue: GameVariableValue
  description?: string
}

/** Shared gameplay fields (no scene placement). `id` is the runtime pool key (= className). */
export interface ObjectTypeDef {
  id: string
  displayName: string
  tags:        string[]
  sprite:      SpriteComponent
  animation?:  AnimationState
  physics?:    PhysicsComponent
  collisionBody?: CollisionBodyComponent
  scriptPath?: string
  visible?:    boolean
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
  defaultLogicBoardId?:  string
  localVariables?:       GameVariableDefinition[]
}

/** Scene placement of an object type. */
export interface SceneInstanceDef {
  id:           number
  objectTypeId: string
  instanceName?: string
  transform:    Transform
  visible?:     boolean
  /** Render layer this instance is drawn on (references a ProjectDoc.layers id). Single source of truth. */
  layerId?:     LayerId
  localVariableOverrides?: Record<string, GameVariableValue>
}

export interface EntityDef {
  id:          number
  name:        string
  className:   string
  tags:        string[]
  transform:   Transform
  sprite:      SpriteComponent
  animation?:  AnimationState
  physics?:    PhysicsComponent
  collisionBody?: CollisionBodyComponent
  scriptPath?: string
  visible?:    boolean   // hidden in play when false; always drawn in editor preview
  /** Render layer id (transient: materialized from the scene instance, never persisted on the entity). */
  layerId?:    LayerId
  // ECS gameplay components (Scene Editor Phase A) — optional, strongly typed
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
  localVariables?:       GameVariableDefinition[]
  localVariableOverrides?: Record<string, GameVariableValue>
}

export interface SceneDef {
  id:              string
  name:            string
  worldSize:       Vec2
  viewportSize:    Vec2
  /**
   * World-space top-left of the camera's initial view (the slice the player
   * sees when the scene starts). Defaults to (0,0). The runtime snaps the
   * gameplay camera here at scene load; game logic / follow targets may then
   * move it. Only meaningful when the scene is larger than the viewport.
   */
  cameraStart?:    Vec2
  backgroundColor: Vec4
  /** Derived from `instances` for legacy code paths; kept in sync on load/save. */
  entityIds:       number[]
  /** v2: scene instances (placement only). */
  instances?:      SceneInstanceDef[]
  /** Per-scene visual overrides for render layers, keyed by LayerId. */
  layerSettings?:  Record<LayerId, SceneLayerSettings>
  tilemap?:        TilemapLayer                       // merged result sent to WASM (computed from tilemapLayers)
  tilemapLayers?:  Record<LayerId, TilemapLayer>      // per-layer paint data; layer id → grid
}

/** When the physics world steps each fixed tick. */
export type PhysicsMode = 'off' | 'auto' | 'on'

/** Global world simulation settings (Scene Editor Phase B). */
export interface WorldSettings {
  /** When true, Logic Board compile emits debug.log traces for rule conditions. */
  logicDebugTrace?: boolean
  /** When true, runtime draws physics collider outlines while playing. */
  physicsDebugDraw?: boolean
  /** When true, status bar shows FPS and profiler timings during play. */
  showRuntimeStats?: boolean
  gravity:        number   // m/s^2 (world vertical gravity, Y-down)
  pixelsPerMeter: number   // metric scale, e.g. 100 px = 1 m
  timeScale:      number   // engine speed multiplier (0..2, 1 = normal)
  physicsMode?:   PhysicsMode  // default 'auto' — step only when bodies exist
}

export const DEFAULT_WORLD: WorldSettings = {
  gravity: 9.81, pixelsPerMeter: 100, timeScale: 1, physicsMode: 'auto',
}

/**
 * A project image asset (sprites, spritesheets). Stored in the project so it
 * survives reopen/.artcade. `path` is relative to the project root
 * (e.g. "assets/images/hero.png") and is also the key the runtime renders
 * with (entity.sprite.spriteAssetId / TilesetAsset.spriteImagePath).
 * `dataUrl` is a transient in-memory copy (browser / pre-save preview /
 * delivery to the WASM runtime); it is NOT serialized.
 */
export interface ImagePointDef {
  id: string
  /** Normalised 0..1 on sprite texture */
  x: number
  y: number
}

/** Pixel sub-rectangle on a sprite sheet, one frame of an animation clip. */
export interface AnimationFrameRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Named animation clip authored on an ImageAsset (a sprite sheet). Compiled
 * to a `SpriteAnimator::Clip` at project load time so the runtime can play
 * it via `animation.play(entity, clipName)`. See ASSETS_ROADMAP.md Phase 1.
 */
export interface AnimationClipDef {
  name:   string
  frames: AnimationFrameRect[]
  fps:    number    // playback speed; > 0
  loop:   boolean   // when false, fires onAnimationEnd once
}

export const IMAGE_ASSET_USAGES = ['sprite', 'background', 'parallax', 'ui'] as const

export type ImageAssetUsage = (typeof IMAGE_ASSET_USAGES)[number]

export const IMAGE_ASSET_USAGE_LABELS: Record<ImageAssetUsage, string> = {
  sprite: 'Sprites',
  background: 'Backgrounds',
  parallax: 'Parallax',
  ui: 'UI',
}

export interface ImageAsset {
  id:       string
  name:     string
  path:     string
  usage:    ImageAssetUsage
  contentHash?: string
  dataUrl?: string
  /** Default draw anchor for entities using this sheet (normalised 0..1). */
  defaultPivot?: Vec2
  imagePoints?: ImagePointDef[]
  /** Optional sprite-sheet animation clips. See AnimationClipDef. */
  clips?: AnimationClipDef[]
}

export interface AudioAsset {
  id:       string
  name:     string
  path:     string
  contentHash?: string
  category?: 'sfx' | 'music'
  volume?:  number
}

export interface FontAsset {
  id:           string
  name:         string
  path:         string
  contentHash?: string
  defaultSize?: number
}

export type AssetFolderCategory = 'images' | 'audio' | 'fonts' | 'scripts' | 'tilesets'

export interface AssetVirtualFolderDef {
  id: string
  name: string
  category: AssetFolderCategory
  /** Required for image folders; custom folders live under one native image usage group. */
  usage?: ImageAssetUsage
  assetRefs: ReadonlyArray<
    | { type: 'image'; id: string }
    | { type: 'audio'; id: string }
    | { type: 'font'; id: string }
    | { type: 'tileset'; id: string }
  >
}

export interface ProjectDoc {
  projectName:    string
  version:        string
  /** 2 = objectTypes + scene instances on disk; entities are materialized in memory. */
  formatVersion?: number
  licenseTier?:   'free' | 'pro'
  world?:         WorldSettings
  targetFPS:      number
  activeSceneId:  string
  mainScriptPath: string
  /** Object type catalog (v2). */
  objectTypes?:   Record<string, ObjectTypeDef>
  /** Materialized cache for editor/runtime; rebuilt from types + instances. */
  entities:       Record<number, EntityDef>
  scenes:         Record<string, SceneDef>
  thumbnails?:    Record<string, string>
  tilePalette?:   TileDef[]              // Scene Editor Phase C (legacy colour)
  physics?:       { layers?: PhysicsLayerDef[] }
  collisionProfiles?: Record<string, CollisionProfileDef>
  tilesets?:      Record<string, TilesetAsset>  // Phase F: image tilesets
  assets?:        Record<string, ImageAsset>    // persistent image library
  audioAssets?:   Record<string, AudioAsset>
  fontAssets?:    Record<string, FontAsset>
  assetVirtualFolders?: Record<string, AssetVirtualFolderDef>
  logicBoards?:   LogicBoardDoc          // visual game logic, compiled to Lua
  globalVariables?: GameVariableDefinition[]
  /** Render layer stack — ordered highest-to-lowest priority (index 0 drawn on top). */
  layers?:        LayerDef[]
}

// ---------------------------------------------------------------------------
// Editor-only types
// ---------------------------------------------------------------------------

/** Top-level mode: Canvas/Scene editor · Logic Board · Script editor */
export type EditorView = 'canvas' | 'logic' | 'script'

export interface EditorSelection {
  entityId: number | null
  sceneId:  string | null
}

export interface ScriptFile {
  path:    string
  content: string
  isDirty: boolean
}

export type ConsoleLevel = 'info' | 'warn' | 'error' | 'lua'

export interface ConsoleEntry {
  id:      number
  time:    string
  message: string
  level:   ConsoleLevel
}

// EditorState legacy aggregate type removed in Sprint 4 cleanup —
// the active state shape now lives in store/editor-store-state.ts as
// the split CoreState / VolatileState pair. No importers were found.
