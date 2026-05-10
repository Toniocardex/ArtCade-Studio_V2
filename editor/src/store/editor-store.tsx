import { createContext, useContext, useReducer } from 'react'
import type { ReactNode, Dispatch } from 'react'
import type {
  EditorState, EditorView, BottomTab,
  ScriptFile, ProjectDoc, ConsoleEntry,
} from '../types'

// ---------------------------------------------------------------------------
// Sample project data
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

const initialState: EditorState = {
  project:          SAMPLE_PROJECT,
  projectPath:      null,
  selection:        { entityId: null, sceneId: 'scene_main' },
  view:             'scene',
  bottomTab:        'assets',
  openScripts:      [{ path: 'scripts/player_controller.lua', content: SAMPLE_SCRIPT, isDirty: false }],
  activeScriptPath: 'scripts/player_controller.lua',
  isPlaying:        false,
  consoleLogs:      INITIAL_LOGS,
  cursorPos:        { x: 0, y: 0 },
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

function reducer(state: EditorState, action: Action): EditorState {
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
    case 'LOG':
      return { ...state, consoleLogs: [...state.consoleLogs, action.entry] }
    case 'SET_CURSOR':
      return { ...state, cursorPos: { x: action.x, y: action.y } }
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
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface EditorContextValue {
  state:    EditorState
  dispatch: Dispatch<Action>
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be inside EditorProvider')
  return ctx
}
