import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project-factory'
import { collectReferencedProjectPaths } from './collect-referenced-project-paths'

describe('collectReferencedProjectPaths', () => {
  it('includes scripts assigned to entities and object types', () => {
    const project = createBlankProject()
    project.entities = {
      1: { scriptPath: 'scripts/entity.lua' } as never,
    }
    project.objectTypes = {
      enemy: { scriptPath: 'scripts/enemy.lua' } as never,
    }

    expect(collectReferencedProjectPaths(project)).toEqual(expect.arrayContaining([
      project.mainScriptPath,
      'scripts/entity.lua',
      'scripts/enemy.lua',
    ]))
  })
})
