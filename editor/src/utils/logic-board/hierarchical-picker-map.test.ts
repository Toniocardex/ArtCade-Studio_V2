import { describe, expect, it } from 'vitest'
import { actionHierarchy, triggerHierarchy } from './hierarchical-picker-map'
import { TRIGGER_TYPES } from '../../panels/logic-board/options'

describe('hierarchical-picker-map', () => {
  it('groups triggers by picker category', () => {
    const tree = triggerHierarchy(TRIGGER_TYPES)
    expect(tree.length).toBeGreaterThan(0)
    const allLeaves = tree.flatMap((n) => n.children ?? [])
    expect(allLeaves.some((l) => l.id === 'onInput')).toBe(true)
  })

  it('labels actions with actionDisplayName', () => {
    const tree = actionHierarchy(['startDialog', 'setVariable'])
    const labels = tree.flatMap((n) => n.children ?? []).map((c) => c.label)
    expect(labels).toContain('Start dialog')
    expect(labels).toContain('Set score or variable')
  })
})
