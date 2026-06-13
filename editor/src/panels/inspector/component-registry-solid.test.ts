import { describe, it, expect } from 'vitest'
import { descriptorFor } from './component-registry'

describe('Solid component registry', () => {
  it('exposes Solid | One-Way select labels', () => {
    const solid = descriptorFor('solid')
    expect(solid).toBeDefined()
    if (!solid) return

    const surface = solid.fields.find((f) => f.key === 'surfaceKind')
    expect(surface).toBeDefined()
    if (!surface) return

    expect(surface.options).toEqual(['solid', 'oneWay'])
    expect(surface.optionLabels).toEqual(['Solid', 'One-Way'])
  })

  it('create() defaults to solid surface', () => {
    const solid = descriptorFor('solid')
    expect(solid).toBeDefined()
    if (!solid) return

    const inst = solid.create()
    expect(inst).toMatchObject({ groundClass: 'Ground', surfaceKind: 'solid' })
  })
})
