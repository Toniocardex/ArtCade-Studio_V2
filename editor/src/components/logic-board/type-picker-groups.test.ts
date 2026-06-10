import { describe, expect, it } from 'vitest'
import { buildTypePickerGroups, flattenTypePickerGroups } from './type-picker-groups'

describe('buildTypePickerGroups', () => {
  it('returns empty array when types is empty', () => {
    expect(buildTypePickerGroups('action', [])).toEqual([])
  })

  it('places recommended types in the recommended bucket for actions', () => {
    const groups = buildTypePickerGroups('action', ['setVelocity', 'playSound'], {
      recommendedTypes: ['setVelocity'],
    })
    expect(groups[0]).toEqual({
      label: 'Recommended for this object',
      types: ['setVelocity'],
    })
    expect(groups.some((g) => g.types.includes('playSound'))).toBe(true)
  })

  it('uses Common checks label for recommended conditions', () => {
    const groups = buildTypePickerGroups('condition', ['isKeyDown', 'overlap'], {
      recommendedTypes: ['isKeyDown'],
    })
    expect(groups[0]?.label).toBe('Common checks')
    expect(groups[0]?.types).toEqual(['isKeyDown'])
  })

  it('sorts trigger groups in the canonical picker order', () => {
    const groups = buildTypePickerGroups('trigger', ['onTimer', 'onInput', 'onSpawn'])
    const labels = groups.map((g) => g.label)
    expect(labels).toEqual(['Time', 'Object state', 'Input'])
  })

  it('flattenTypePickerGroups preserves group order', () => {
    const groups = buildTypePickerGroups('action', ['setVelocity', 'playSound', 'destroyEntity'], {
      recommendedTypes: ['setVelocity'],
    })
    expect(flattenTypePickerGroups(groups)).toEqual([
      'setVelocity',
      ...groups
        .slice(1)
        .flatMap((g) => g.types),
    ])
  })
})
