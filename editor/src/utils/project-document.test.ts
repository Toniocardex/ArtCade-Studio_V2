import { describe, expect, it } from 'vitest'
import { serializeProjectDoc } from './project-codec'
import { createBlankProject } from './project-factory'
import {
  CURRENT_PROJECT_FORMAT_VERSION,
  EDITOR_ENGINE_VERSION,
} from './project-format'
import {
  loadProjectDocument,
  parseProjectJsonRoot,
  ProjectLoadError,
  resolveProjectFormatVersion,
  validateSerializedProjectDocument,
} from './project-document'

describe('project-document', () => {
  it('rejects invalid JSON', () => {
    expect(() => loadProjectDocument('not json')).toThrow(ProjectLoadError)
    try {
      loadProjectDocument('not json')
    } catch (err) {
      expect((err as ProjectLoadError).code).toBe('unreadable')
    }
  })

  it('rejects a format newer than the editor supports', () => {
    const json = JSON.stringify({ projectFormatVersion: CURRENT_PROJECT_FORMAT_VERSION + 1 })
    expect(() => loadProjectDocument(json)).toThrow(ProjectLoadError)
    try {
      loadProjectDocument(json)
    } catch (err) {
      expect((err as ProjectLoadError).code).toBe('newer_than_editor')
    }
  })

  it('loads a serialized project with envelope metadata', () => {
    const project = createBlankProject('Envelope Test')
    const json = serializeProjectDoc(project)
    const root = parseProjectJsonRoot(json)

    expect(resolveProjectFormatVersion(root)).toBe(CURRENT_PROJECT_FORMAT_VERSION)
    expect(root.projectFormatVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION)
    expect(root.engineVersion).toBe(EDITOR_ENGINE_VERSION)
    expect(typeof root.projectId).toBe('string')

    const loaded = loadProjectDocument(json)
    expect(loaded.project.projectName).toBe('Envelope Test')
    expect(loaded.project.projectFormatVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION)
    expect(loaded.project.projectId).toBe(root.projectId)
  })

  it('accepts legacy formatVersion when projectFormatVersion is absent', () => {
    const project = createBlankProject('Legacy')
    const json = serializeProjectDoc(project)
    const root = parseProjectJsonRoot(json)
    delete root.projectFormatVersion
    root.formatVersion = CURRENT_PROJECT_FORMAT_VERSION

    const loaded = loadProjectDocument(JSON.stringify(root))
    expect(loaded.project.projectName).toBe('Legacy')
  })

  it('validates serialized output before save contract', () => {
    const project = createBlankProject('Round trip')
    const json = serializeProjectDoc(project)
    expect(() => validateSerializedProjectDocument(json)).not.toThrow()
  })
})
