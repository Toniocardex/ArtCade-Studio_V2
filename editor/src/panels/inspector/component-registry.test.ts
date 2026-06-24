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
    expect(descriptorFor('collisionBody')?.label).toBe('Collision Body')
    expect(descriptorFor('magneticItem')?.label).toBe('Magnetic Attraction')
    expect(descriptorFor('text')?.label).toBe('Text Label')
    expect(descriptorFor('gauge')?.label).toBe('Gauge')
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

  it('Collision Body defaults to an enabled static body', () => {
    const collision = descriptorFor('collisionBody')
    expect(collision).toBeDefined()
    if (!collision) return

    expect(collision.create()).toMatchObject({
      bodyType: 'static',
      enabled: true,
      shapes: [{ type: 'rectangle', response: 'solid', role: 'body' }],
    })
  })

  it('creates Dialog components without a hardcoded conversation', () => {
    const dialog = descriptorFor('dialog')
    expect(dialog).toBeDefined()
    if (!dialog) return

    expect(dialog.create()).toMatchObject({
      dialogId: '',
      startNode: '',
      textSpeed: 40,
    })
  })
})
