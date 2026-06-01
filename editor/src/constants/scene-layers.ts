/** UI-only layer names until ProjectDoc gains a persisted layer model. */
export const SCENE_LAYER_ROWS = [
  { name: 'Debug', order: 700 },
  { name: 'UI', order: 600 },
  { name: 'Foreground', order: 500 },
  { name: 'Gameplay', order: 400 },
  { name: 'Collision', order: 300 },
  { name: 'Platforms', order: 200 },
  { name: 'Background', order: 100 },
  { name: 'Parallax Far', order: 0 },
] as const

export const SCENE_LAYER_NAMES = SCENE_LAYER_ROWS.map((r) => r.name)

export const DEFAULT_EDITOR_ACTIVE_LAYER = 'Gameplay'
