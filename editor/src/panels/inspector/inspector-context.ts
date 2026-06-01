// ---------------------------------------------------------------------------
// inspector-context — derive right-panel mode from editor selection
// ---------------------------------------------------------------------------

import type { CoreState } from '../../store/editor-store-state'
import type { InspectorAssetSelection } from '../../types/inspector-selection'

export type InspectorMode = 'scene' | 'entity' | 'layer' | 'asset'

export type InspectorChrome = Readonly<{
  mode: InspectorMode
  title: string
  subtitle: string
}>

export function deriveInspectorMode(state: CoreState): InspectorMode {
  if (state.selection.entityId != null) return 'entity'
  if (state.inspectorAsset != null) return 'asset'
  if (state.inspectorLayerName != null) return 'layer'
  return 'scene'
}

export function inspectorChromeForMode(
  mode: InspectorMode,
  state: CoreState,
): InspectorChrome {
  const project = state.project
  switch (mode) {
    case 'entity': {
      const id = state.selection.entityId
      const entity = id != null && project ? project.entities[id] : undefined
      return {
        mode,
        title: 'Entity Inspector',
        subtitle: entity?.name ?? (id != null ? `Entity ${id}` : ''),
      }
    }
    case 'asset': {
      const sel = state.inspectorAsset
      const label = sel ? assetSelectionLabel(sel, project) : 'Asset'
      return {
        mode,
        title: 'Asset Inspector',
        subtitle: label,
      }
    }
    case 'layer':
      return {
        mode,
        title: 'Layer Settings',
        subtitle: state.inspectorLayerName ?? '',
      }
    default: {
      const sceneId = state.selection.sceneId ?? project?.activeSceneId
      const scene = sceneId && project ? project.scenes[sceneId] : undefined
      return {
        mode: 'scene',
        title: 'Scene Settings',
        subtitle: scene?.name ?? 'No scene',
      }
    }
  }
}

function assetSelectionLabel(
  sel: InspectorAssetSelection,
  project: CoreState['project'],
): string {
  if (!project) return sel.id
  switch (sel.type) {
    case 'image': {
      const a = project.assets?.[sel.id]
      return a?.name ?? sel.id
    }
    case 'audio': {
      const a = project.audioAssets?.[sel.id]
      return a?.name ?? sel.id
    }
    case 'font': {
      const a = project.fontAssets?.[sel.id]
      return a?.name ?? sel.id
    }
    case 'tileset': {
      const a = project.tilesets?.[sel.id]
      return a?.name ?? sel.id
    }
  }
}
