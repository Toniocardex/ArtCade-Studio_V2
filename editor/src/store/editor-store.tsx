import { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import type { ReactNode, Dispatch } from 'react'
import type {
  EditorView, BottomTab,
  ScriptFile, ProjectDoc, ConsoleEntry,
} from '../types'

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
  selection:        { entityId: number | null; sceneId: string | null }
  view:             EditorView
  bottomTab:        BottomTab
  openScripts:      ScriptFile[]
  activeScriptPath: string | null
  isPlaying:        boolean
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
  gameResolution: { x: 1280, y: 720 },
  targetFPS:      60,
  activeSceneId:  'scene_main',
  mainScriptPath: 'scripts/main.lua',
  entities: {
    1: {
      id: 1, name: 'Player_Hero', className: 'Player', tags: ['player'],
      transform: { position: { x: 120, y: 340 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: 'hero_idle.png', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 1 }, renderOrder: 2 },
      scriptPath: 'scripts/player_controller.lua',
    },
    2: {
      id: 2, name: 'Level_01_Tilemap', className: 'Tilemap', tags: ['map'],
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: 'forest_tileset.png', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0, y: 0 }, renderOrder: 0 },
    },
    3: {
      id: 3, name: 'Enemy_Slime_01', className: 'Slime', tags: ['enemy'],
      transform: { position: { x: 500, y: 340 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite:    { spriteAssetId: '', tint: { x: 0.2, y: 1, z: 0.4, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 1 }, renderOrder: 2 },
    },
  },
  scenes: {
    scene_main: {
      id: 'scene_main', name: 'Level_01',
      worldSize:       { x: 3840, y: 720 },
      viewportSize:    { x: 1280, y: 720 },
      backgroundColor: { x: 0.04, y: 0.07, z: 0.13, w: 1 },
      entityIds: [1, 2, 3],
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

const INITIAL_LOGS: ConsoleEntry[] = [
  { id: 1, time: '16:42:01', message: 'ArtCade Engine Core Initialized.',              level: 'info'  },
  { id: 2, time: '16:42:02', message: 'WASM Runtime: Memory allocated (64 MB).',        level: 'lua'   },
  { id: 3, time: '16:42:03', message: 'Project loaded: Neon_Runner v2.0.0',             level: 'info'  },
  { id: 4, time: '16:42:05', message: "Warning: 'hero_run.png' — non-power-of-two dimensions.", level: 'warn'  },
  { id: 5, time: '16:42:10', message: "Lua Error: attempt to index nil in 'main.lua' line 42.", level: 'error' },
]

const initialCoreState: CoreState = {
  project:          SAMPLE_PROJECT,
  projectPath:      null,
  selection:        { entityId: null, sceneId: 'scene_main' },
  view:             'scene',
  bottomTab:        'assets',
  openScripts:      [{ path: 'scripts/player_controller.lua', content: SAMPLE_SCRIPT, isDirty: false }],
  activeScriptPath: 'scripts/player_controller.lua',
  isPlaying:        false,
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
  | { type: 'SET_VIEW';          view: EditorView }
  | { type: 'SET_BOTTOM_TAB';    tab: BottomTab }
  | { type: 'SET_PLAYING';       playing: boolean }
  | { type: 'UPDATE_SCRIPT';     path: string; content: string }
  | { type: 'OPEN_SCRIPT';       file: ScriptFile }
  | { type: 'SET_ACTIVE_SCRIPT'; path: string }
  | { type: 'LOG';               entry: ConsoleEntry }
  | { type: 'SET_CURSOR';        x: number; y: number }
  | { type: 'LOAD_PROJECT';      project: ProjectDoc; path: string }
  | { type: 'MARK_SCRIPT_SAVED'; path: string }

// ---------------------------------------------------------------------------
// Core reducer — handles project/selection/mode; ignores LOG and SET_CURSOR
// ---------------------------------------------------------------------------

function coreReducer(state: CoreState, action: Action): CoreState {
  switch (action.type) {
    case 'SELECT_ENTITY':
      return { ...state, selection: { ...state.selection, entityId: action.entityId } }
    case 'SELECT_SCENE':
      return { ...state, selection: { ...state.selection, sceneId: action.sceneId, entityId: null } }
    case 'SET_VIEW':
      return { ...state, view: action.view }
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
        view:             'logic',
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
        selection:   { entityId: null, sceneId: action.project.activeSceneId || firstSceneId },
        openScripts: [],
        activeScriptPath: null,
        isPlaying:   false,
        bottomTab:   'console',
      }
    }
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
