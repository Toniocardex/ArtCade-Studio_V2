import { describe, it, expect } from 'vitest'
import { COMPONENT_REGISTRY, descriptorFor } from './component-registry'
import { COMPONENT_KEYS } from '../../types/components'

const byKey = (a: string, b: string) => a.localeCompare(b)

describe('component registry', () => {
  it('has a descriptor for every component key (and vice-versa)', () => {
    const regKeys = COMPONENT_REGISTRY.map((d) => d.key).sort(byKey)
    expect(regKeys).toEqual([...COMPONENT_KEYS].sort(byKey))
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
    const sensor = descriptorFor('sensor')
    expect(sensor).toBeDefined()
    if (!sensor) return

    const radius = sensor.fields.find((f) => f.key === 'radius')
    const width = sensor.fields.find((f) => f.key === 'width')
    expect(radius?.visibleWhen).toBeDefined()
    expect(width?.visibleWhen).toBeDefined()
    if (!radius?.visibleWhen || !width?.visibleWhen) return

    const circle = { shape: 'Circle' }
    const rect = { shape: 'Rectangle' }

    expect(radius.visibleWhen(circle)).toBe(true)
    expect(radius.visibleWhen(rect)).toBe(false)
    expect(width.visibleWhen(rect)).toBe(true)
    expect(width.visibleWhen(circle)).toBe(false)
  })
})
