import type { LayerBackground, LayerDef, LayerParallax } from '../types'

/** Default layer stack seeded into new/legacy projects (highest priority first). */
export const DEFAULT_LAYERS: LayerDef[] = [
  { name: 'Background' },
]

export const DEFAULT_EDITOR_ACTIVE_LAYER = 'Background'

/** Neutral parallax: contents move 1:1 with the world (no parallax effect). */
export const DEFAULT_PARALLAX: LayerParallax = { x: 1, y: 1 }

/** Resolve a layer's parallax, falling back to the neutral default. */
export function layerParallax(layer: Pick<LayerDef, 'parallax'>): LayerParallax {
  const p = layer.parallax
  return {
    x: Number.isFinite(p?.x) ? (p as LayerParallax).x : 1,
    y: Number.isFinite(p?.y) ? (p as LayerParallax).y : 1,
  }
}

/** True when a layer's parallax differs from the neutral 1:1 default. */
export function hasParallax(layer: Pick<LayerDef, 'parallax'>): boolean {
  const { x, y } = layerParallax(layer)
  return x !== 1 || y !== 1
}

/** True when a layer paints a background image. */
export function hasLayerBackground(
  layer: Pick<LayerDef, 'background'>,
): layer is { background: LayerBackground } {
  return !!layer.background && layer.background.imageId.trim().length > 0
}
