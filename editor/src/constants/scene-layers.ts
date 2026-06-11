import type { LayerDef } from '../types'

/** Default layer stack seeded into new/legacy projects (highest priority first). */
export const DEFAULT_LAYERS: LayerDef[] = [
  { name: 'Background' },
]

export const DEFAULT_EDITOR_ACTIVE_LAYER = 'Background'
