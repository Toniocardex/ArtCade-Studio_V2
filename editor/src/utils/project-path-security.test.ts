import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project'
import { validateProjectBeforeSave } from './logic-board/validate-project'
import { normalizeProjectRelativePath } from './project-path-security'

describe('project path security', () => {
  it('normalises safe project-relative paths', () => {
    expect(normalizeProjectRelativePath('scripts\\main.lua')).toBe('scripts/main.lua')
  })

  it('rejects absolute and traversal main script paths before save', () => {
    const project = createBlankProject('Unsafe')

    project.mainScriptPath = 'C:/Users/Test/Desktop/pwn.lua'
    expect(() => validateProjectBeforeSave(project)).toThrow(/mainScriptPath/)

    project.mainScriptPath = '../pwn.lua'
    expect(() => validateProjectBeforeSave(project)).toThrow(/mainScriptPath/)
  })

  it('rejects asset paths that escape the project folder', () => {
    const project = createBlankProject('Unsafe Asset')
    project.assets = {
      img: {
        id: 'img',
        name: 'Bad',
        path: 'assets/../secret.png',
      },
    }

    expect(() => validateProjectBeforeSave(project)).toThrow(/asset "Bad" path/)
  })
})
