import { describe, it, expect } from 'vitest'
import { flushProjectNameDraft } from './useProjectNameEditor'
import { createBlankProject } from '../../utils/project'

describe('flushProjectNameDraft', () => {
  it('applies pending toolbar name to the ProjectDoc', () => {
    const project = createBlankProject('Untitled')
    const { project: flushed, nextDraft, didRename } = flushProjectNameDraft(project, 'My Game')

    expect(flushed.projectName).toBe('My Game')
    expect(nextDraft).toBe('My Game')
    expect(didRename).toBe(true)
  })

  it('sanitises unsafe characters in the draft', () => {
    const project = createBlankProject('Untitled')
    const { project: flushed, nextDraft } = flushProjectNameDraft(project, 'Bad:/Name')

    expect(flushed.projectName).toBe('Bad__Name')
    expect(nextDraft).toBe('Bad__Name')
  })
})
