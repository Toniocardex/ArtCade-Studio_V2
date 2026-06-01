import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProjectDoc } from '../types'
import {
  clearProjectWorkbenchCache,
  getProjectWorkbenchSnapshot,
  playBlockReason,
} from './project-health'
import * as logicCompile from './logic-board/logic-compile-service'

function minimalProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [],
      },
    },
  }
}

describe('getProjectWorkbenchSnapshot', () => {
  beforeEach(() => {
    clearProjectWorkbenchCache()
    vi.restoreAllMocks()
  })

  it('blocks play when active scene is invalid', () => {
    const p = minimalProject()
    p.activeSceneId = 'nope'
    const snap = getProjectWorkbenchSnapshot({
      project: p,
      includeCompile: true,
    })
    expect(snap.health.blocksPlay).toBe(true)
    expect(playBlockReason(p)).toMatch(/activeSceneId/)
  })

  it('allows play on clean minimal project', () => {
    const snap = getProjectWorkbenchSnapshot({
      project: minimalProject(),
      includeCompile: true,
    })
    expect(snap.health.blocksPlay).toBe(false)
    expect(playBlockReason(minimalProject())).toBeNull()
  })

  it('calls compileProjectLogic only once per cache key', () => {
    const compileSpy = vi.spyOn(logicCompile, 'compileProjectLogic').mockReturnValue({
      ok: true,
      lua: 'function tick() end',
      diagnostics: [],
      compileError: null,
    })

    const project = {
      ...minimalProject(),
      logicBoards: [{
        boardId: 'b1',
        target: { type: 'global' as const },
        events: [],
      }],
    }

    const input = {
      project,
      projectPath: '/p/game.artcade',
      openScripts: [],
      includeCompile: true,
    }

    getProjectWorkbenchSnapshot(input)
    getProjectWorkbenchSnapshot(input)

    expect(compileSpy).toHaveBeenCalledTimes(1)
  })
})
