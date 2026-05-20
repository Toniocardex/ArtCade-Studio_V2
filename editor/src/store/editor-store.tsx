import { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import type { ReactNode, Dispatch } from 'react'
import type {
  EditorView, BottomTab,
  ScriptFile, ProjectDoc, ConsoleEntry,
  LogicBoard, LogicEvent, ComponentKey, WorldSettings, TilesetAsset, ImageAsset,
  SpriteComponent,
} from '../types'
import { DEFAULT_WORLD, createTilemap } from '../types'
import { createEntityDef, nextEntityId } from '../utils/project'

// ---------------------------------------------------------------------------
// State split:
//   CoreState    — project, selection, scripts, play-mode (changes rarely)
//   VolatileState — consoleLogs, cursorPos (changes every frame / every log)
//
// WHY: all useContext() consumers re-render when their context value changes.
// PreviewPanel must NOT re-render on every debug.log() from Lua, otherwise
// React reconciliation runs during Emscripten's rAF callback → WebGL
// compositing glitch visible as a one-frame flash when entities are destroyed.
// ---------------------------------------------------------------------------

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
}

// ---- Volatile state (high-frequency) ---------------------------------------

export interface VolatileState {
  consoleLogs: ConsoleEntry[]
  cursorPos:   { x: number; y: number }
}

// ---------------------------------------------------------------------------
// Sample project (editor default until user opens a real one)
// ---------------------------------------------------------------------------

const SAMPLE_PROJECT: ProjectDoc = {
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

const SAMPLE_SCRIPT = `-- player_controller.lua  (ArtCade V2)
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

const INITIAL_LOGS: ConsoleEntry[] = []

const initialCoreState: CoreState = {
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
}

const initialVolatileState: VolatileState = {
  consoleLogs: INITIAL_LOGS,
  cursorPos:   { x: 0, y: 0 },
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

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
  | { type: 'WORLD_SET';         patch: Partial<WorldSettings> }
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

// ---------------------------------------------------------------------------
// Core reducer — handles project/selection/mode; ignores LOG and SET_CURSOR
// ---------------------------------------------------------------------------

/**
 * Apply a transform to project.logicBoards immutably and mark dirty.
 * No-op (returns state unchanged) when there is no open project.
 */
function withBoards(
  state: CoreState,
  fn: (boards: LogicBoard[]) => LogicBoard[],
): CoreState {
  if (!state.project) return state
  const next = fn(state.project.logicBoards ?? [])
  return {
    ...state,
    project: { ...state.project, logicBoards: next },
    projectDirty: true,
  }
}

export function coreReducer(state: CoreState, action: Action): CoreState {
  switch (action.type) {
    case 'SELECT_ENTITY':
      return { ...state, selection: { ...state.selection, entityId: action.entityId } }
    case 'SELECT_SCENE':
      return { ...state, selection: { ...state.selection, sceneId: action.sceneId, entityId: null } }
    case 'SET_MODE':
      return { ...state, mode: action.mode }
    case 'SET_BOTTOM_TAB':
      return { ...state, bottomTab: action.tab }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing }
    case 'UPDATE_SCRIPT': {
      const openScripts = state.openScripts.map(s =>
        s.path === action.path ? { ...s, content: action.content, isDirty: true } : s
      )
      return { ...state, openScripts }
    }
    case 'OPEN_SCRIPT': {
      const exists = state.openScripts.some(s => s.path === action.file.path)
      return {
        ...state,
        openScripts:      exists ? state.openScripts : [...state.openScripts, action.file],
        activeScriptPath: action.file.path,
        mode:             'script',
      }
    }
    case 'UPSERT_SCRIPT': {
      const isDirty = action.isDirty ?? false
      const exists = state.openScripts.some(s => s.path === action.path)
      const openScripts = exists
        ? state.openScripts.map(s =>
            s.path === action.path ? { ...s, content: action.content, isDirty } : s,
          )
        : [...state.openScripts, { path: action.path, content: action.content, isDirty }]
      return {
        ...state,
        openScripts,
        ...(action.activate ? { activeScriptPath: action.path } : {}),
      }
    }
    case 'SET_ACTIVE_SCRIPT':
      return { ...state, activeScriptPath: action.path }
    case 'LOAD_PROJECT': {
      const firstSceneId = Object.keys(action.project.scenes)[0] ?? null
      return {
        ...state,
        project:     action.project,
        projectPath: action.path,
        projectDirty: false,
        selection:   { entityId: null, sceneId: action.project.activeSceneId || firstSceneId },
        openScripts: [],
        activeScriptPath: null,
        isPlaying:   false,
        bottomTab:   'console',
      }
    }
    case 'UPDATE_ENTITY_TRANSFORM': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: {
              ...entity,
              transform: {
                ...entity.transform,
                position: { x: action.x, y: action.y },
                rotation: action.rotation,
                scale: { x: action.scaleX, y: action.scaleY },
              },
            },
          },
        },
        projectDirty: true,
      }
    }
    case 'LOGIC_ADD_BOARD':
      return withBoards(state, (b) =>
        b.some((x) => x.boardId === action.board.boardId)
          ? b
          : [...b, action.board],
      )
    case 'LOGIC_DELETE_BOARD':
      return withBoards(state, (b) =>
        b.filter((x) => x.boardId !== action.boardId),
      )
    case 'LOGIC_ADD_EVENT':
      return withBoards(state, (b) =>
        b.map((board) =>
          board.boardId === action.boardId
            ? { ...board, events: [...board.events, action.event] }
            : board,
        ),
      )
    case 'LOGIC_UPDATE_EVENT':
      return withBoards(state, (b) =>
        b.map((board) =>
          board.boardId === action.boardId
            ? {
                ...board,
                events: board.events.map((e) =>
                  e.id === action.event.id ? action.event : e,
                ),
              }
            : board,
        ),
      )
    case 'LOGIC_DELETE_EVENT':
      return withBoards(state, (b) =>
        b.map((board) =>
          board.boardId === action.boardId
            ? {
                ...board,
                events: board.events.filter((e) => e.id !== action.eventId),
              }
            : board,
        ),
      )
    case 'ENTITY_SET_SPRITE': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...entity, sprite: action.sprite },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_COMPONENT': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...entity, [action.key]: action.value },
          },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_REMOVE_COMPONENT': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entity = state.project.entities[action.entityId]
      // omit the component key immutably
      const rest = Object.fromEntries(
        Object.entries(entity).filter(([k]) => k !== action.key),
      ) as typeof entity
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [action.entityId]: rest },
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_ADD': {
      if (!state.project || !state.project.scenes[action.sceneId]) return state
      const id = nextEntityId(state.project)
      const ent = createEntityDef(id)
      const scene = state.project.scenes[action.sceneId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [id]: ent },
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...scene, entityIds: [...scene.entityIds, id] },
          },
        },
        selection: { ...state.selection, entityId: id },
        projectDirty: true,
      }
    }
    case 'ENTITY_DUPLICATE': {
      if (
        !state.project ||
        !state.project.entities[action.entityId] ||
        !state.project.scenes[action.sceneId]
      )
        return state
      const src = state.project.entities[action.entityId]
      const id = nextEntityId(state.project)
      // Plain JSON-serializable EntityDef → deep clone is safe.
      const clone: typeof src = JSON.parse(JSON.stringify(src))
      clone.id = id
      clone.name = `${src.name}_Copy`
      clone.transform = {
        ...clone.transform,
        position: {
          x: clone.transform.position.x + 16,
          y: clone.transform.position.y + 16,
        },
      }
      const scene = state.project.scenes[action.sceneId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: { ...state.project.entities, [id]: clone },
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...scene, entityIds: [...scene.entityIds, id] },
          },
        },
        selection: { ...state.selection, entityId: id },
        projectDirty: true,
      }
    }
    case 'ENTITY_DELETE': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const entities = Object.fromEntries(
        Object.entries(state.project.entities).filter(
          ([k]) => Number(k) !== action.entityId,
        ),
      )
      const scenes = Object.fromEntries(
        Object.entries(state.project.scenes).map(([sid, sc]) => [
          sid,
          { ...sc, entityIds: sc.entityIds.filter((i) => i !== action.entityId) },
        ]),
      )
      return {
        ...state,
        project: { ...state.project, entities, scenes },
        selection: {
          ...state.selection,
          entityId:
            state.selection.entityId === action.entityId
              ? null
              : state.selection.entityId,
        },
        projectDirty: true,
      }
    }
    case 'ENTITY_SET_VISIBLE': {
      if (!state.project || !state.project.entities[action.entityId]) return state
      const e = state.project.entities[action.entityId]
      return {
        ...state,
        project: {
          ...state.project,
          entities: {
            ...state.project.entities,
            [action.entityId]: { ...e, visible: action.visible },
          },
        },
        projectDirty: true,
      }
    }
    case 'WORLD_SET': {
      if (!state.project) return state
      const world = { ...DEFAULT_WORLD, ...state.project.world, ...action.patch }
      return {
        ...state,
        project: { ...state.project, world },
        projectDirty: true,
      }
    }
    case 'TILEMAP_INIT': {
      const sc = state.project?.scenes[action.sceneId]
      if (!state.project || !sc) return state
      const tm = createTilemap(sc.worldSize.x, sc.worldSize.y)
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, tilemap: tm },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILEMAP_PAINT': {
      const sc = state.project?.scenes[action.sceneId]
      if (!state.project || !sc) return state
      // auto-create the layer on first paint
      const tm = sc.tilemap ?? createTilemap(sc.worldSize.x, sc.worldSize.y)
      if (action.index < 0 || action.index >= tm.data.length) return state
      if (tm.data[action.index] === action.tileId && sc.tilemap) return state
      const data = tm.data.slice()
      data[action.index] = action.tileId
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, tilemap: { ...tm, data } },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILEMAP_PAINT_CELL': {
      // C++ painting sends (col,row); resolve to index using the layer cols.
      const sc = state.project?.scenes[action.sceneId]
      if (!state.project || !sc?.tilemap) return state
      const tm = sc.tilemap
      if (action.col < 0 || action.col >= tm.cols ||
          action.row < 0 || action.row >= tm.rows) return state
      const index = action.row * tm.cols + action.col
      if (tm.data[index] === action.tileId) return state
      const data = tm.data.slice()
      data[index] = action.tileId
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: { ...sc, tilemap: { ...tm, data } },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILESET_ASSET_ADD': {
      if (!state.project) return state
      return {
        ...state,
        project: {
          ...state.project,
          tilesets: {
            ...(state.project.tilesets ?? {}),
            [action.asset.assetId]: action.asset,
          },
        },
        projectDirty: true,
      }
    }
    case 'TILESET_ASSET_REMOVE': {
      if (!state.project || !state.project.tilesets) return state
      const tilesets = Object.fromEntries(
        Object.entries(state.project.tilesets).filter(
          ([k]) => k !== action.assetId,
        ),
      )
      // detach from any scene that referenced it
      const scenes = Object.fromEntries(
        Object.entries(state.project.scenes).map(([sid, sc]) => {
          if (sc.tilemap?.tilesetAssetId !== action.assetId) return [sid, sc]
          const { tilesetAssetId: _drop, ...rest } = sc.tilemap
          return [sid, { ...sc, tilemap: rest }]
        }),
      )
      return {
        ...state,
        project: { ...state.project, tilesets, scenes },
        projectDirty: true,
      }
    }
    case 'ASSET_ADD': {
      if (!state.project) return state
      return {
        ...state,
        project: {
          ...state.project,
          assets: {
            ...(state.project.assets ?? {}),
            [action.asset.id]: action.asset,
          },
        },
        projectDirty: true,
      }
    }
    case 'ASSET_REMOVE': {
      if (!state.project || !state.project.assets) return state
      const removed = state.project.assets[action.assetId]
      const assets = Object.fromEntries(
        Object.entries(state.project.assets).filter(
          ([k]) => k !== action.assetId,
        ),
      )
      // Detach the sprite from any entity that referenced this image so it
      // falls back cleanly instead of pointing at a missing asset.
      const entities = removed
        ? Object.fromEntries(
            Object.entries(state.project.entities).map(([eid, e]) =>
              e.sprite?.spriteAssetId === removed.path
                ? [eid, { ...e, sprite: { ...e.sprite, spriteAssetId: '' } }]
                : [eid, e],
            ),
          )
        : state.project.entities
      return {
        ...state,
        project: { ...state.project, assets, entities },
        projectDirty: true,
      }
    }
    case 'TILEMAP_SET_TILESETID': {
      const sc = state.project?.scenes[action.sceneId]
      if (!state.project || !sc) return state
      const tm = sc.tilemap ?? createTilemap(sc.worldSize.x, sc.worldSize.y)
      return {
        ...state,
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [action.sceneId]: {
              ...sc,
              tilemap: { ...tm, tilesetAssetId: action.assetId },
            },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILESET_SELECT_CELL':
      // pure UI state — does not dirty the project
      return { ...state, selectedTileCell: Math.max(0, action.cellIndex) }
    case 'MARK_PROJECT_SAVED':
      return { ...state, projectDirty: false }
    case 'MARK_SCRIPT_SAVED': {
      return {
        ...state,
        openScripts: state.openScripts.map(s =>
          s.path === action.path ? { ...s, isDirty: false } : s
        ),
      }
    }
    // LOG and SET_CURSOR are handled only by volatileReducer — return unchanged
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Volatile reducer — handles logs and cursor; ignores everything else
// ---------------------------------------------------------------------------

function volatileReducer(state: VolatileState, action: Action): VolatileState {
  switch (action.type) {
    case 'LOG':
      return { ...state, consoleLogs: [...state.consoleLogs, action.entry] }
    case 'SET_CURSOR':
      return { ...state, cursorPos: { x: action.x, y: action.y } }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

interface CoreContextValue {
  state:    CoreState
  dispatch: Dispatch<Action>
}

interface VolatileContextValue {
  state:    VolatileState
  dispatch: Dispatch<Action>
}

const CoreContext     = createContext<CoreContextValue | null>(null)
const VolatileContext = createContext<VolatileContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function EditorProvider({ children }: { children: ReactNode }) {
  const [coreState,     coreDi]  = useReducer(coreReducer,     initialCoreState)
  const [volatileState, volDi]   = useReducer(volatileReducer, initialVolatileState)

  // Single stable dispatch that fans out to both reducers.
  // Wrapped in useCallback so its reference never changes → contexts that
  // receive it as a dep (useMemo below) won't needlessly re-create their value.
  const dispatch = useCallback((action: Action) => {
    coreDi(action)
    volDi(action)
  }, [coreDi, volDi])

  // Memoize context values so reference only changes when the respective
  // state slice changes.  PreviewPanel consumes CoreContext only → it will
  // NOT re-render when consoleLogs or cursorPos change.
  const coreValue     = useMemo(() => ({ state: coreState,     dispatch }), [coreState,     dispatch])
  const volatileValue = useMemo(() => ({ state: volatileState, dispatch }), [volatileState, dispatch])

  return (
    <CoreContext.Provider value={coreValue}>
      <VolatileContext.Provider value={volatileValue}>
        {children}
      </VolatileContext.Provider>
    </CoreContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * useEditor() — subscribes to CoreContext (project, selection, mode, scripts).
 * Does NOT re-render when consoleLogs or cursorPos change.
 * Use for: PreviewPanel, HierarchyPanel, InspectorPanel, ScriptEditor, MenuBar, etc.
 */
export function useEditor(): CoreContextValue {
  const ctx = useContext(CoreContext)
  if (!ctx) throw new Error('useEditor must be inside EditorProvider')
  return ctx
}

/**
 * useConsoleLogs() — subscribes to VolatileContext (consoleLogs, cursorPos).
 * Re-renders on every log line and mouse move — use only where needed.
 * Use for: ConsolePanel, StatusBar.
 */
export function useConsoleLogs(): VolatileContextValue {
  const ctx = useContext(VolatileContext)
  if (!ctx) throw new Error('useConsoleLogs must be inside EditorProvider')
  return ctx
}
