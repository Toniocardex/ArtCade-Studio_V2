import type {
  LayerBackground,
  LayerDef,
  LayerId,
  LayerParallax,
  SceneDef,
  SceneLayerSettings,
} from '../types'

/** Stable id of the layer seeded into new/legacy projects. */
export const DEFAULT_LAYER_ID: LayerId = 'background'

/** Default layer stack seeded into new/legacy projects (highest priority first). */
export const DEFAULT_LAYERS: LayerDef[] = [
  { id: DEFAULT_LAYER_ID, name: 'Background' },
]

/** Active authoring layer id for a fresh project. */
export const DEFAULT_EDITOR_ACTIVE_LAYER_ID: LayerId = DEFAULT_LAYER_ID

/** Neutral parallax: contents move 1:1 with the world (no parallax effect). */
export const DEFAULT_PARALLAX: LayerParallax = { x: 1, y: 1 }

let layerIdSeq = 0

/** Generate a process-unique, project-stable LayerId. */
export function newLayerId(): LayerId {
  layerIdSeq += 1
  return `lyr_${Date.now().toString(36)}_${layerIdSeq.toString(36)}`
}

/** Editor-only lock flag (global, lives on LayerDef). */
export function layerLocked(layer: Pick<LayerDef, 'locked'>): boolean {
  return layer.locked === true
}

/** Per-scene settings for a layer, or an empty object when the scene has no override. */
export function sceneLayerSettings(
  scene: Pick<SceneDef, 'layerSettings'> | undefined,
  layerId: LayerId,
): SceneLayerSettings {
  return scene?.layerSettings?.[layerId] ?? {}
}

/** Resolve a layer's parallax from its per-scene settings, falling back to neutral. */
export function layerParallax(settings: Pick<SceneLayerSettings, 'parallax'>): LayerParallax {
  const p = settings.parallax
  return {
    x: Number.isFinite(p?.x) ? (p as LayerParallax).x : 1,
    y: Number.isFinite(p?.y) ? (p as LayerParallax).y : 1,
  }
}

export function layerVisible(settings: Pick<SceneLayerSettings, 'visible'>): boolean {
  return settings.visible !== false
}

export function layerOpacity(settings: Pick<SceneLayerSettings, 'opacity'>): number {
  const opacity = Number(settings.opacity)
  if (!Number.isFinite(opacity)) return 1
  return Math.min(1, Math.max(0, opacity))
}

/** True when a layer's parallax differs from the neutral 1:1 default. */
export function hasParallax(settings: Pick<SceneLayerSettings, 'parallax'>): boolean {
  const { x, y } = layerParallax(settings)
  return x !== 1 || y !== 1
}

/** True when a layer paints a background image. */
export function hasLayerBackground(
  settings: Pick<SceneLayerSettings, 'background'>,
): settings is { background: LayerBackground } {
  return !!settings.background && settings.background.imageId.trim().length > 0
}

/** Drop neutral per-scene layer settings so scenes stay lean (returns undefined when fully default). */
export function normalizeSceneLayerSettings(
  settings: SceneLayerSettings,
): SceneLayerSettings | undefined {
  const out: SceneLayerSettings = {}
  if (!layerVisible(settings)) out.visible = false
  if (layerLocked(settings as Pick<LayerDef, 'locked'>)) {
    // locked is global, never stored per-scene; ignore if present.
  }
  const opacity = layerOpacity(settings)
  if (opacity !== 1) out.opacity = opacity
  if (settings.parallax && hasParallax(settings)) out.parallax = settings.parallax
  if (settings.background && hasLayerBackground(settings)) out.background = settings.background
  return Object.keys(out).length > 0 ? out : undefined
}
