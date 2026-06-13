import { describe, expect, it } from 'vitest'
import { createEntityDef } from './project-builders'
import { createBlankProject } from './project-factory'
import { parseProjectDoc, serializeProjectDoc } from './project'
import {
  buildObjectModelFromEntities,
  effectiveTypeId,
  entitiesForRuntimeSync,
  materializeEntity,
  migrateLegacyProject,
  PROJECT_FORMAT_V3,
  syncObjectModelFromEntities,
} from './project-object-types'
import { runtimeProjectFingerprint } from './runtime-fingerprint'

describe('project-object-types', () => {
  it('effectiveTypeId uses className when not generic', () => {
    const e = createEntityDef(1, 'Hero', 'Player')
    expect(effectiveTypeId(e)).toBe('Player')
  })

  it('effectiveTypeId falls back to slugged name for generic class', () => {
    const e = createEntityDef(1, 'coin pickup', 'Entity')
    expect(effectiveTypeId(e)).toBe('Coin_pickup')
  })

  it('syncObjectModelFromEntities builds types without rematerializing entities', () => {
    const base = createBlankProject('Test')
    const ent = createEntityDef(1, 'Entity_1', 'Entity', { x: 4, y: 8 })
    const synced = syncObjectModelFromEntities({
      ...base,
      entities: { 1: ent },
      scenes: {
        scene_main: {
          ...base.scenes.scene_main,
          entityIds: [1],
        },
      },
    })
    expect(synced.objectTypes?.Entity_1).toBeDefined()
    expect(synced.scenes.scene_main.instances?.[0]?.objectTypeId).toBe('Entity_1')
    expect(synced.entities[1]).toBe(ent)
    expect(synced.entities[1].transform.position).toEqual({ x: 4, y: 8 })
  })

  it('migrateLegacyProject builds types and instances', () => {
    const base = createBlankProject('Test')
    const player = createEntityDef(1, 'Player', 'Player', { x: 10, y: 20 })
    const coin = createEntityDef(2, 'Coin', 'Coin', { x: 50, y: 30 })
    const migrated = migrateLegacyProject({
      ...base,
      entities: { 1: player, 2: coin },
      scenes: {
        scene_main: {
          ...base.scenes.scene_main,
          entityIds: [1, 2],
        },
      },
    })
    expect(migrated.formatVersion).toBe(PROJECT_FORMAT_V3)
    expect(migrated.objectTypes?.Player).toBeDefined()
    expect(migrated.objectTypes?.Coin).toBeDefined()
    expect(migrated.scenes.scene_main.instances?.length).toBe(2)
    expect(migrated.entities[1].className).toBe('Player')
    expect(migrated.entities[2].transform.position.x).toBe(50)
  })

  it('materializeEntity merges type + instance', () => {
    const { objectTypes } = buildObjectModelFromEntities(
      migrateLegacyProject({
        ...createBlankProject(),
        entities: {
          1: createEntityDef(1, 'Player', 'Player'),
        },
        scenes: {
          scene_main: {
            ...createBlankProject().scenes.scene_main,
            entityIds: [1],
          },
        },
      }),
    )
    const type = objectTypes.Player
    const ent = materializeEntity(type, {
      id: 99,
      objectTypeId: 'Player',
      instanceName: 'Hero',
      transform: { position: { x: 1, y: 2 }, scale: { x: 1, y: 1 }, rotation: 0 },
    })
    expect(ent.id).toBe(99)
    expect(ent.name).toBe('Hero')
    expect(ent.className).toBe('Player')
    expect(ent.transform.position).toEqual({ x: 1, y: 2 })
  })

  it('entitiesForRuntimeSync uses project.entities overrides over type prototype', () => {
    const migrated = migrateLegacyProject({
      ...createBlankProject(),
      entities: {
        1: createEntityDef(1, 'Player', 'Player'),
      },
      scenes: {
        scene_main: {
          ...createBlankProject().scenes.scene_main,
          entityIds: [1],
        },
      },
    })
    const fpBase = runtimeProjectFingerprint(migrated, 'scene_main')
    migrated.entities[1] = {
      ...migrated.entities[1],
      sprite: {
        ...migrated.entities[1].sprite,
        pivotFromAsset: false,
        pivot: { x: 0.5, y: 1 },
      },
    }
    const synced = entitiesForRuntimeSync(migrated)
    expect(synced[1].sprite.pivot).toEqual({ x: 0.5, y: 1 })
    expect(runtimeProjectFingerprint(migrated, 'scene_main')).not.toBe(fpBase)
  })

  it('serialize v2 omits flat entities map', () => {
    const migrated = migrateLegacyProject({
      ...createBlankProject('V2'),
      entities: {
        1: createEntityDef(1, 'Player', 'Player'),
      },
      scenes: {
        scene_main: {
          ...createBlankProject().scenes.scene_main,
          entityIds: [1],
        },
      },
    })
    const json = serializeProjectDoc(migrated)
    expect(json).toMatch(/"formatVersion"\s*:\s*3/)
    expect(json).toContain('"objectTypes"')
    expect(json).toContain('"instances"')
    expect(json).not.toMatch(/"entities"\s*:/)
    const again = parseProjectDoc(json)!
    expect(again.entities[1]?.className).toBe('Player')
    expect(again.objectTypes?.Player).toBeDefined()
  })
})
