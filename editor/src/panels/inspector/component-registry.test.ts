import { describe, it, expect } from 'vitest'
import { COMPONENT_REGISTRY, descriptorFor } from './component-registry'
import { COMPONENT_KEYS } from '../../types/components'

describe('component registry', () => {
  it('has a descriptor for every component key (and vice-versa)', () => {
    const regKeys = COMPONENT_REGISTRY.map((d) => d.key).sort()
    expect(regKeys).toEqual([...COMPONENT_KEYS].sort())
  })

  it('descriptorFor resolves by key', () => {
    expect(descriptorFor('sensor')?.label).toMatch(/Sensor/)
    expect(descriptorFor('health')?.color).toBeTruthy()
  })

  it('create() yields an object covering all non-conditional fields', () => {
    for (const d of COMPONENT_REGISTRY) {
      const inst = d.create()
      for (const f of d.fields) {
        if (!f.visibleWhen) expect(inst).toHaveProperty(f.key)
      }
    }
  })

  it('Sensor conditional fields depend on shape', () => {
    const sensor = descriptorFor('sensor')!
    const radius = sensor.fields.find((f) => f.key === 'radius')!
    const width = sensor.fields.find((f) => f.key === 'width')!
    expect(radius.visibleWhen!({ shape: 'Circle' })).toBe(true)
    expect(radius.visibleWhen!({ shape: 'Rectangle' })).toBe(false)
    expect(width.visibleWhen!({ shape: 'Rectangle' })).toBe(true)
    expect(width.visibleWhen!({ shape: 'Circle' })).toBe(false)
  })
})
