import { describe, it, expect } from 'vitest'
import { descriptorFor } from './component-registry'

describe('Platform Surface (solid) registry', () => {
  it('exposes Solid | One-Way select labels', () => {
    const solid = descriptorFor('solid')!
    const surface = solid.fields.find((f) => f.key === 'surfaceKind')!
    expect(surface.options).toEqual(['solid', 'oneWay'])
    expect(surface.optionLabels).toEqual(['Solid', 'One-Way'])
  })

  it('create() defaults to solid surface', () => {
    const inst = descriptorFor('solid')!.create()
    expect(inst).toMatchObject({ groundClass: 'Ground', surfaceKind: 'solid' })
  })
})
