import { describe, expect, it } from 'vitest'
import type { ProjectHealth } from './project-health'
import { projectHealthConsoleEntries } from './project-health-console'

describe('projectHealthConsoleEntries', () => {
  it('includes every error and warning with source and context', () => {
    const health: ProjectHealth = {
      blocksPlay: true,
      errors: [
        { severity: 'error', source: 'project', context: 'entity:1', message: 'Missing sprite.' },
        { severity: 'error', source: 'logic-compile', context: 'board:b1', message: 'Compile failed.' },
      ],
      warnings: [
        { severity: 'warn', source: 'logic-config', message: 'Unused rule.' },
      ],
    }

    expect(projectHealthConsoleEntries(health)).toEqual([
      {
        id: -1,
        time: 'VALIDATE',
        level: 'error',
        message: '[project | entity:1] Missing sprite.',
      },
      {
        id: -2,
        time: 'VALIDATE',
        level: 'error',
        message: '[logic-compile | board:b1] Compile failed.',
      },
      {
        id: -3,
        time: 'VALIDATE',
        level: 'warn',
        message: '[logic-config] Unused rule.',
      },
    ])
  })
})
