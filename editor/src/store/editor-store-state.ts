// ---------------------------------------------------------------------------
// editor-store-state — type definitions + initial values for the store
// ---------------------------------------------------------------------------
//
// Kept in a separate file from editor-store.tsx so that per-domain reducers
// in editor/src/store/reducers/ can import these types without creating a
// cycle with the provider module.

import type {
  EditorView, BottomTab,
  ScriptFile, ProjectDoc, ConsoleEntry,
  LogicBoard, LogicEvent, ComponentKey, WorldSettings, TilesetAsset, ImageAsset,
  SpriteComponent,
} from '../types'

// ---- Core state (stable) ---------------------------------------------------

export interface CoreState {
  project:          ProjectDoc | null
  projectPath:      string | null
  projectDirty:     boolean
  selection:        { entityId: number | null; sceneId: string | null }
  mode:             EditorView
  bottomTab:        BottomTab
  openScripts:      ScriptFile[]
  activeScriptPath: string | null
  isPlaying:        boolean
  selectedTileCell: number   // Phase F: brush cell id (1-based, 0 = eraser)
  editorGridSize?:  number   // editor-only guide/snap grid, not ProjectDoc tilemap
  snapToGrid?:      boolean  // editor-only; not persisted in ProjectDoc
}

// ---- Volatile state (high-frequency) ---------------------------------------

export interface VolatileState {
  consoleLogs: ConsoleEntry[]
  cursorPos:   { x: number; y: number }
}

// ---- Actions ---------------------------------------------------------------

export type Action =
  | { type: 'SELECT_ENTITY';     entityId: number | null }
  | { type: 'SELECT_SCENE';      sceneId: string }
  | { type: 'SET_MODE';          mode: EditorView }
  | { type: 'SET_BOTTOM_TAB';    tab: BottomTab }
  | { type: 'SET_PLAYING';       playing: boolean }
  | { type: 'UPDATE_SCRIPT';     path: string; content: string }
  | { type: 'OPEN_SCRIPT';       file: ScriptFile }
  /** Add or update script buffer without switching editor mode (Logic Board sync). */
  | { type: 'UPSERT_SCRIPT';    path: string; content: string; isDirty?: boolean; activate?: boolean }
  | { type: 'SET_ACTIVE_SCRIPT'; path: string }
  | { type: 'LOG';               entry: ConsoleEntry }
  | { type: 'SET_CURSOR';        x: number; y: number }
  | { type: 'LOAD_PROJECT';      project: ProjectDoc; path: string }
  | { type: 'MARK_PROJECT_SAVED' }
  | { type: 'MARK_SCRIPT_SAVED'; path: string }
  | { type: 'UPDATE_ENTITY_TRANSFORM'; entityId: number; x: number; y: number; rotation: number; scaleX: number; scaleY: number }
  | { type: 'ENTITY_SET_SPRITE';       entityId: number; sprite: SpriteComponent }
  | { type: 'ENTITY_SET_COMPONENT';    entityId: number; key: ComponentKey; value: object }
  | { type: 'ENTITY_REMOVE_COMPONENT'; entityId: number; key: ComponentKey }
  | { type: 'ENTITY_ADD';        sceneId: string }
  | { type: 'ENTITY_DUPLICATE';  entityId: number; sceneId: string }
  | { type: 'ENTITY_DELETE';     entityId: number }
  | { type: 'ENTITY_SET_VISIBLE'; entityId: number; visible: boolean }
  | { type: 'ENTITY_SET_NAME';    entityId: number; name: string }
  | { type: 'ENTITY_SET_CLASSNAME'; entityId: number; className: string }
  | { type: 'WORLD_SET';         patch: Partial<WorldSettings> }
  | { type: 'SCENE_ADD_EMPTY'; sourceSceneId?: string; name?: string }
  | { type: 'SCENE_RENAME';    sceneId: string; name: string }
  | { type: 'SCENE_SET_START'; sceneId: string }
  | { type: 'SCENE_DELETE';    sceneId: string }
  | { type: 'SCENE_SET_WORLD_SIZE'; sceneId: string; x: number; y: number }
  | { type: 'SCENE_SET_VIEWPORT_SIZE'; sceneId: string; x: number; y: number }
  | { type: 'EDITOR_SET_GRID_SIZE'; tileSize: number }
  | { type: 'SET_SNAP_TO_GRID'; enabled: boolean }
  | { type: 'TILEMAP_INIT';  sceneId: string }
  | { type: 'TILEMAP_PAINT'; sceneId: string; index: number; tileId: number }
  | { type: 'TILEMAP_PAINT_CELL'; sceneId: string; col: number; row: number; tileId: number }
  | { type: 'TILESET_ASSET_ADD';     asset: TilesetAsset }
  | { type: 'TILESET_ASSET_REMOVE';  assetId: string }
  | { type: 'ASSET_ADD';             asset: ImageAsset }
  | { type: 'ASSET_REMOVE';          assetId: string }
  | { type: 'TILEMAP_SET_TILESETID'; sceneId: string; assetId: string }
  | { type: 'TILESET_SELECT_CELL';   cellIndex: number }
  // ---- Logic Board CRUD (all operate on project.logicBoards) ----
  | { type: 'LOGIC_ADD_BOARD';    board: LogicBoard }
  | { type: 'LOGIC_DELETE_BOARD'; boardId: string }
  | { type: 'LOGIC_ADD_EVENT';    boardId: string; event: LogicEvent }
  | { type: 'LOGIC_UPDATE_EVENT'; boardId: string; event: LogicEvent }
  | { type: 'LOGIC_DELETE_EVENT'; boardId: string; eventId: string }

export type DomainReducer = (state: CoreState, action: Action) => CoreState

// ---------------------------------------------------------------------------
// Sample project (editor default until the user opens a real one)
// ---------------------------------------------------------------------------

export const SAMPLE_PROJECT: ProjectDoc = {
  projectName:    'Neon_Runner',
  version:        '2.0.0',
  licenseTier:    'free',
  gameResolution: { x: 1280, y: 720 },
  targetFPS:      60,
  activeSceneId:  'scene_main',
  mainScriptPath: 'scripts/main.lua',
  entities: {
    1: {
      id: 1, name: 'Player', className: 'Player', tags: ['player', 'controllable'],
      transform: { position: { x: 640, y: 340 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: '', tint: { x: 0.2, y: 0.6, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 1 },
    },
    2: {
      id: 2, name: 'Patrol_A', className: 'Enemy', tags: ['enemy'],
      transform: { position: { x: 200, y: 280 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: '', tint: { x: 1, y: 0.2, z: 0.2, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
    },
    3: {
      id: 3, name: 'Patrol_B', className: 'Enemy', tags: ['enemy'],
      transform: { position: { x: 950, y: 200 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: '', tint: { x: 1, y: 0.4, z: 0, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
    },
    4: {
      id: 4, name: 'Coin_1', className: 'Coin', tags: ['pickup'],
      transform: { position: { x: 400, y: 300 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: '', tint: { x: 1, y: 0.9, z: 0.1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
    },
    5: {
      id: 5, name: 'Coin_2', className: 'Coin', tags: ['pickup'],
      transform: { position: { x: 780, y: 200 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: '', tint: { x: 1, y: 0.9, z: 0.1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
    },
    6: {
      id: 6, name: 'PhysicsBall', className: 'PhysicsBall', tags: ['physics'],
      transform: { position: { x: 640, y: 60 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: '', tint: { x: 0, y: 1, z: 0.5, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 2 },
    },
    7: {
      id: 7, name: 'PhysicsFloor', className: 'PhysicsFloor', tags: ['physics', 'static'],
      transform: { position: { x: 640, y: 640 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: '', tint: { x: 0.5, y: 0.35, z: 0.1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
    },
  },
  scenes: {
    scene_main: {
      id: 'scene_main', name: 'Main Scene',
      worldSize:       { x: 1280, y: 720 },
      viewportSize:    { x: 1280, y: 720 },
      backgroundColor: { x: 0.04, y: 0.05, z: 0.12, w: 1 },
      entityIds: [1, 2, 3, 4, 5, 6, 7],
    },
    scene_menu: {
      id: 'scene_menu', name: 'Main_Menu',
      worldSize:       { x: 1280, y: 720 },
      viewportSize:    { x: 1280, y: 720 },
      backgroundColor: { x: 0.04, y: 0.04, z: 0.08, w: 1 },
      entityIds: [],
    },
  },
}

export const SAMPLE_SCRIPT = `-- player_controller.lua  (ArtCade V2)
-- Chiamato ogni fixed-step (~60 fps).

function tick(dt)
    local hero = pool.getFirst("Player")
    if not hero then return end

    local speed = 320 * dt
    local vx, vy = 0, entity.velocity(hero).y

    if input.isKeyDown("A") then vx = -speed end
    if input.isKeyDown("D") then vx =  speed end

    -- Salto
    if input.wasKeyPressed("Space") and collision.touchingClass(hero, "Ground") then
        vy = -600
    end

    entity.setVelocity(hero, vx, vy)

    -- Collisione con nemici
    for _, enemy in ipairs(pool.getAll("Slime")) do
        if collision.overlap(hero, enemy) then
            state.add("hp", -1)
            event.emit("player.hit", { damage = 1 })
            audio.playSound("assets/audio/hurt.ogg", 0.8, 1.0)
        end
    end
end
`

export const INITIAL_LOGS: ConsoleEntry[] = []

export const initialCoreState: CoreState = {
  project:          SAMPLE_PROJECT,
  projectPath:      null,
  projectDirty:     false,
  selection:        { entityId: null, sceneId: 'scene_main' },
  mode:             'canvas',
  bottomTab:        'assets',
  openScripts:      [{ path: 'scripts/player_controller.lua', content: SAMPLE_SCRIPT, isDirty: false }],
  activeScriptPath: 'scripts/player_controller.lua',
  isPlaying:        false,
  selectedTileCell: 1,
  editorGridSize:   32,
  snapToGrid:       false,
}

export const initialVolatileState: VolatileState = {
  consoleLogs: INITIAL_LOGS,
  cursorPos:   { x: 0, y: 0 },
}
