import { describe, it, expect } from 'vitest'
import { deriveInspectorMode, inspectorChromeForMode } from './inspector-context'
import type { CoreState } from '../../store/editor-store-state'
import { initialCoreState } from '../../store/editor-store-state'

function base(patch: Partial<CoreState> = {}): CoreState {
  return { ...initialCoreState, ...patch }
}

describe('deriveInspectorMode', () => {
  it('prefers entity over asset and layer', () => {
    const s = base({
      selection: { entityId: 1, sceneId: 'scene_main' },
      inspectorAsset: { type: 'image', id: 'img_a' },
      inspectorLayerName: 'UI',
    })
    expect(deriveInspectorMode(s)).toBe('entity')
  })

  it('shows asset when no entity', () => {
    const s = base({
      inspectorAsset: { type: 'audio', id: 'snd_a' },
      inspectorLayerName: 'UI',
    })
    expect(deriveInspectorMode(s)).toBe('asset')
  })

  it('shows layer when only layer is selected', () => {
    const s = base({ inspectorLayerName: 'Gameplay' })
    expect(deriveInspectorMode(s)).toBe('layer')
  })

  it('defaults to scene', () => {
    expect(deriveInspectorMode(base())).toBe('scene')
  })
})

describe('inspectorChromeForMode', () => {
  it('labels asset mode', () => {
    const s = base({
      inspectorAsset: { type: 'image', id: 'hero' },
    })
    const chrome = inspectorChromeForMode('asset', s)
    expect(chrome.title).toBe('Asset Inspector')
  })
})
