import { describe, expect, it } from 'vitest'
import { createLogicBoardForObjectType } from './factory'
import {
  logicBoardNeedsPreviewApply,
  logicBoardScriptOutOfSync,
} from './logic-board-revisions'
import type { ProjectDoc } from '../../types'

function projectWithBoards(boards: ReturnType<typeof createLogicBoardForObjectType>[]): ProjectDoc {
  return {
    projectName: 'T',
    mainScriptPath: 'scripts/main.lua',
    logicBoards: boards,
    scenes: {},
    activeSceneId: 's',
    assets: { images: [], tilesets: [], audio: [], fonts: [] },
    objectTypes: {},
    world: { gravity: 0, timeScale: 1 },
  } as ProjectDoc
}

describe('logicBoardNeedsPreviewApply', () => {
  it('is false when preview revision matches boards', () => {
    const board = createLogicBoardForObjectType('P', 'pc')
    const project = projectWithBoards([board])
    const rev = JSON.stringify(project.logicBoards)
    expect(logicBoardNeedsPreviewApply(project, true, rev)).toBe(false)
  })

  it('is true when preview revision is stale', () => {
    const project = projectWithBoards([createLogicBoardForObjectType('P', 'pc')])
    expect(logicBoardNeedsPreviewApply(project, true, '')).toBe(true)
  })
})

describe('logicBoardScriptOutOfSync', () => {
  it('detects script buffer behind rules', () => {
    const project = projectWithBoards([createLogicBoardForObjectType('P', 'pc')])
    expect(logicBoardScriptOutOfSync(project, null)).toBe(true)
  })
})
