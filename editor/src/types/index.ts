// ---------------------------------------------------------------------------
// Shared types — mirrors C++ ProjectDoc / EntityDef / SceneDef structs
// ---------------------------------------------------------------------------

export * from './logic-board'
export * from './components'
export * from './tilemap'
import type { LogicBoardDoc } from './logic-board'
import type { TileDef, TilemapLayer } from './tilemap'
import type {
  SensorComponent, PlatformerControllerComponent,
  HealthComponent, AutoDestroyComponent,
} from './components'

export interface Vec2 { x: number; y: number }
export interface Vec4 { x: number; y: number; z: number; w: number }

export interface Transform {
  position: Vec2
  scale:    Vec2
  rotation: number   // radians (matches C++ — editor displays in degrees)
  velocity?: Vec2    // runtime-only; zero at rest
}

export interface SpriteComponent {
  spriteAssetId: string
  tint:          Vec4    // stored as {x,y,z,w} in TS; C++ emits {r,g,b,a} — parseProjectDoc normalises
  alpha:         number
  pivot:         Vec2    // normalised anchor 0..1, default {x:0.5, y:0.5}
  renderOrder:   number
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
  visible?:    boolean   // editor visibility (undefined = visible). Phase B.
  // ECS gameplay components (Scene Editor Phase A) — optional, strongly typed
  sensor?:               SensorComponent
  platformerController?: PlatformerControllerComponent
  health?:               HealthComponent
  autoDestroy?:          AutoDestroyComponent
}

export interface SceneDef {
  id:              string
  name:            string
  worldSize:       Vec2
  viewportSize:    Vec2
  backgroundColor: Vec4
  entityIds:       number[]
  tilemap?:        TilemapLayer   // Scene Editor Phase C (editor-side)
}

/** Global world simulation settings (Scene Editor Phase B). */
export interface WorldSettings {
  gravity:        number   // m/s^2 (Box2D vertical gravity)
  pixelsPerMeter: number   // metric scale, e.g. 100 px = 1 m
  timeScale:      number   // engine speed multiplier (0..2, 1 = normal)
}

export const DEFAULT_WORLD: WorldSettings = {
  gravity: 9.81, pixelsPerMeter: 100, timeScale: 1,
}

export interface ProjectDoc {
  projectName:    string
  version:        string
  licenseTier?:   'free' | 'pro'
  world?:         WorldSettings
  gameResolution: Vec2
  targetFPS:      number
  activeSceneId:  string
  mainScriptPath: string
  entities:       Record<number, EntityDef>
  scenes:         Record<string, SceneDef>
  thumbnails?:    Record<string, string>
  tilePalette?:   TileDef[]              // Scene Editor Phase C
  logicBoards?:   LogicBoardDoc          // visual game logic, compiled to Lua
}

// ---------------------------------------------------------------------------
// Editor-only types
// ---------------------------------------------------------------------------

/** Top-level view: 3-column scene editor vs full-screen Lua code editor */
export type EditorView = 'scene' | 'logic'

/** Bottom panel tab (visible only in scene view) */
export type BottomTab = 'assets' | 'tileset' | 'console'

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

export interface EditorState {
  project:          ProjectDoc | null
  projectPath:      string | null           // absolute path to project.json on disk
  projectDirty:     boolean
  selection:        EditorSelection
  view:             EditorView
  bottomTab:        BottomTab
  openScripts:      ScriptFile[]
  activeScriptPath: string | null
  isPlaying:        boolean
  consoleLogs:      ConsoleEntry[]
  cursorPos:        { x: number; y: number }
}
