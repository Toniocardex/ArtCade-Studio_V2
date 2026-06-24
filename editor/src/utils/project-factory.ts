import type { ProjectDoc, Vec2 } from '../types'
import { DEFAULT_WORLD } from '../types'
import { DEFAULT_SCENE_SIZE, DEFAULT_VIEWPORT_SIZE } from '../constants/editor-viewport'

const sceneSize = (): Vec2 => ({ x: DEFAULT_SCENE_SIZE.x, y: DEFAULT_SCENE_SIZE.y })
const viewportSize = (): Vec2 => ({ x: DEFAULT_VIEWPORT_SIZE.x, y: DEFAULT_VIEWPORT_SIZE.y })

const defaultPhysicsLayers = () => ({
  layers: [
    { id: 'default', name: 'Default', bit: 0, color: '#8B95A7' },
    { id: 'player', name: 'Player', bit: 1, color: '#38BDF8' },
    { id: 'ground', name: 'Ground', bit: 2, color: '#22C55E' },
    { id: 'enemy', name: 'Enemy', bit: 3, color: '#F97316' },
    { id: 'pickup', name: 'Pickup', bit: 4, color: '#FBBF24' },
    { id: 'hazard', name: 'Hazard', bit: 5, color: '#EF4444' },
    { id: 'projectile', name: 'Projectile', bit: 6, color: '#A78BFA' },
    { id: 'interaction', name: 'Interaction', bit: 7, color: '#14B8A6' },
  ],
})

/**
 * Build a minimal valid ProjectDoc the editor can open immediately.
 *
 * The template ships a single scene with NO entities so the canvas opens
 * to a clean state. Adding the first entity is one click in the Scenes panel.
 *
 * @param projectName  Display name (defaults to "Untitled").
 */
export function createBlankProject(projectName = 'Untitled'): ProjectDoc {
  return {
    projectName,
    version:        '1.0.0',
    licenseTier:    'free',
    targetFPS:      60,
    activeSceneId:  'scene_main',
    mainScriptPath: 'scripts/main.lua',
    entities:       {},
    scenes: {
      scene_main: {
        id:              'scene_main',
        name:            'Main Scene',
        worldSize:       sceneSize(),
        viewportSize:    viewportSize(),
        backgroundColor: { x: 0.082, y: 0.090, z: 0.110, w: 1 },
        entityIds:       [],
      },
    },
    world:       { ...DEFAULT_WORLD },
    physics:     defaultPhysicsLayers(),
    collisionProfiles: {},
    logicBoards: [],
  }
}

/**
 * Default main.lua content shipped alongside a fresh project on disk.
 * Kept here (not in api.ts) so unit tests don't need Tauri to verify it.
 */
export const BLANK_MAIN_LUA = `-- main.lua  (ArtCade V2)
-- Called every fixed-step (~60 fps). 'dt' is the delta time in seconds.

function tick(dt)
    -- TODO: add your game logic here.
end
`
