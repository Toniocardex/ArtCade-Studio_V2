// ---------------------------------------------------------------------------
// Shared types — mirrors C++ ProjectDoc / EntityDef / SceneDef structs
// ---------------------------------------------------------------------------

export * from './logic-board'
export * from './components'
export * from './tilemap'
import type { LogicBoardDoc } from './logic-board'
import type { TileDef, TilemapLayer, TilesetAsset } from './tilemap'
import type {
  SensorComponent, SolidComponent, PlatformerControllerComponent,
  TopDownControllerComponent, LinearMoverComponent,
  CameraTargetComponent,
  MagneticItemComponent,
  HordeMemberComponent,
  HealthComponent, AutoDestroyComponent, DialogComponent,
} from './components'

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
  isSensor: boolean
}

export interface PhysicsComponent {
  bodyType: BodyType
  collider: Collider
}

/** Shared gameplay fields (no scene placement). `id` is the runtime pool key (= className). */
export interface ObjectTypeDef {
  id: string
  displayName: string
  tags:        string[]
  sprite:      SpriteComponent
  animation?:  AnimationState
  physics?:    PhysicsComponent
  scriptPath?: string
  visible?:    boolean
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
  dialog?:               DialogComponent
  defaultLogicBoardId?:  string
}

/** Scene placement of an object type. */
export interface SceneInstanceDef {
  id:           number
  objectTypeId: string
  instanceName?: string
  transform:    Transform
  visible?:     boolean
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
  scriptPath?: string
  visible?:    boolean   // hidden in play when false; always drawn in editor preview
  // ECS gameplay components (Scene Editor Phase A) — optional, strongly typed
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
  dialog?:               DialogComponent
}

export interface SceneDef {
  id:              string
  name:            string
  worldSize:       Vec2
  viewportSize:    Vec2
  backgroundColor: Vec4
  /** Derived from `instances` for legacy code paths; kept in sync on load/save. */
  entityIds:       number[]
  /** v2: scene instances (placement only). */
  instances?:      SceneInstanceDef[]
  tilemap?:        TilemapLayer   // Scene Editor Phase C (editor-side)
}

/** When the physics world steps each fixed tick. */
export type PhysicsMode = 'off' | 'auto' | 'on'

/** Global world simulation settings (Scene Editor Phase B). */
export interface WorldSettings {
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

export interface ImageAsset {
  id:       string
  name:     string
  path:     string
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
  category?: 'sfx' | 'music'
  volume?:  number
}

export interface FontAsset {
  id:           string
  name:         string
  path:         string
  defaultSize?: number
}

export type AssetFolderCategory = 'images' | 'audio' | 'fonts' | 'scripts' | 'tilesets'

export interface AssetVirtualFolderDef {
  id: string
  name: string
  category: AssetFolderCategory
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
  tilesets?:      Record<string, TilesetAsset>  // Phase F: image tilesets
  assets?:        Record<string, ImageAsset>    // persistent image library
  audioAssets?:   Record<string, AudioAsset>
  fontAssets?:    Record<string, FontAsset>
  assetVirtualFolders?: Record<string, AssetVirtualFolderDef>
  logicBoards?:   LogicBoardDoc          // visual game logic, compiled to Lua
}

// ---------------------------------------------------------------------------
// Editor-only types
// ---------------------------------------------------------------------------

/** Top-level mode: Canvas/Scene editor · Logic Board · Script editor */
export type EditorView = 'canvas' | 'logic' | 'script' | 'dialog'

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
