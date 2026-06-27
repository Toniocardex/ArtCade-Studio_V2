import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project-factory'
import { prepareSerializedProjectDocument } from './project-persist'
import { loadProjectDocument } from './project-document'

describe('project-persist', () => {
  it('prepareSerializedProjectDocument round-trips through loadProjectDocument', () => {
    const project = createBlankProject('Persist')
    const serialized = prepareSerializedProjectDocument(project)
    const loaded = loadProjectDocument(serialized)
    expect(loaded.project.projectName).toBe('Persist')
    expect(loaded.project.projectFormatVersion).toBeGreaterThan(0)
  })
})
