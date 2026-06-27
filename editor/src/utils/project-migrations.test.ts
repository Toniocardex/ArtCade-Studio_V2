import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CURRENT_PROJECT_FORMAT_VERSION } from './project-format'
import { loadProjectDocument } from './project-document'
import { createBlankProject } from './project-factory'
import { createEntityDef } from './project-builders'
import {
  migrateDocV1ToV3,
  migrateProjectJsonRoot,
  migrateV0ToV1,
  migrateV3ToV4,
} from './project-migrations'
import { PROJECT_FORMAT_V3 } from './project-object-types'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/project-format')

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8')
}

describe('project-migrations', () => {
  it('migrateV0ToV1 stamps formatVersion 1', () => {
    const raw = JSON.parse(readFixture('v0-flat-entities.json')) as Record<string, unknown>
    const migrated = migrateV0ToV1(raw)
    expect(migrated.formatVersion).toBe(1)
  })

  it('migrateProjectJsonRoot stamps v0 and adds v4 envelope for v3', () => {
    const raw = JSON.parse(readFixture('v3-object-model.json')) as Record<string, unknown>
    const result = migrateProjectJsonRoot(raw)
    expect(result.fromVersion).toBe(3)
    expect(result.toVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION)
    expect(result.steps).toEqual([{ from: 3, to: 4 }])
    expect(result.raw.projectFormatVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION)
    expect(typeof result.raw.projectId).toBe('string')
  })

  it('migrateProjectJsonRoot only stamps v0 for legacy flat projects', () => {
    const raw = JSON.parse(readFixture('v1-flat-entities.json')) as Record<string, unknown>
    const result = migrateProjectJsonRoot(raw)
    expect(result.fromVersion).toBe(1)
    expect(result.toVersion).toBe(1)
    expect(result.steps).toEqual([])
  })

  it('migrateDocV1ToV3 lifts flat entities into object types', () => {
    const base = createBlankProject('Fixture V1')
    const player = createEntityDef(1, 'Player', 'Player', { x: 10, y: 20 })
    const project = {
      ...base,
      formatVersion: 1,
      entities: { 1: player },
      scenes: {
        scene_main: {
          ...base.scenes.scene_main,
          entityIds: [1],
        },
      },
    }
    const migrated = migrateDocV1ToV3(project)
    expect(migrated.formatVersion).toBe(PROJECT_FORMAT_V3)
    expect(migrated.objectTypes?.Player).toBeDefined()
    expect(migrated.scenes.scene_main.instances?.[0]?.objectTypeId).toBe('Player')
  })

  it.each([
    ['v0-flat-entities.json', 0],
    ['v1-flat-entities.json', 1],
    ['v2-object-types.json', 2],
    ['v3-object-model.json', 3],
  ])('loadProjectDocument migrates %s to current format', (fixtureName) => {
    const loaded = loadProjectDocument(readFixture(fixtureName))
    expect(loaded.project.projectFormatVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION)
    expect(loaded.project.formatVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION)
    expect(loaded.project.objectTypes?.Player).toBeDefined()
    expect(loaded.project.scenes.scene_main.instances?.length).toBeGreaterThan(0)
    expect(loaded.project.entities[1]?.className).toBe('Player')
  })

  it('migrateV3ToV4 preserves existing projectId', () => {
    const raw = {
      formatVersion: 3,
      projectId: 'fixed-project-id',
      projectName: 'Keep Id',
    }
    const migrated = migrateV3ToV4(raw)
    expect(migrated.projectId).toBe('fixed-project-id')
    expect(migrated.projectFormatVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION)
  })
})
