import { describe, it, expect } from 'vitest'
import { inspectorBodyView, nextInspectorTab } from './inspector-tab-logic'

describe('nextInspectorTab', () => {
  it('defaults to Scene when nothing is selected', () => {
    expect(nextInspectorTab('entity', true, false)).toBe('scene')
  })

  it('opens Entity on first selection', () => {
    expect(nextInspectorTab('scene', false, true)).toBe('entity')
  })

  it('keeps Scene tab when switching entities while on Scene', () => {
    expect(nextInspectorTab('scene', true, true)).toBe('scene')
  })

  it('keeps Entity tab when switching entities while on Entity', () => {
    expect(nextInspectorTab('entity', true, true)).toBe('entity')
  })
})

describe('inspectorBodyView', () => {
  it('shows entity panel only on Entity tab with a selection', () => {
    expect(inspectorBodyView({ tab: 'entity', hasEntity: true, hasScene: true })).toBe('entity')
    expect(inspectorBodyView({ tab: 'scene', hasEntity: true, hasScene: true })).toBe('scene')
    expect(inspectorBodyView({ tab: 'entity', hasEntity: false, hasScene: true })).toBe('empty')
  })
})
