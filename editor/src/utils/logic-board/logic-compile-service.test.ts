import { describe, expect, it, beforeEach } from 'vitest'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { BLANK_MAIN_LUA } from '../project-factory'
import {
  clearLogicCompileCache,
  collectConfigDiagnostics,
  compileProjectLogic,
  configDiagnosticsForBoard,
  formatConfigDiagnosticsSummary,
} from './logic-compile-service'

function entityBoard(events: LogicEvent[] = []): LogicBoard {
  return { boardId: 'b1', target: { type: 'entity_id', entityId: 1 }, events }
}

function invalidGlobalBoard(): LogicBoard {
  return {
    boardId: 'g1',
    target: { type: 'global' },
    events: [
      {
        id: 'e1',
        enabled: true,
        trigger: { type: 'onMouseInput', button: 'right', eventType: 'pressed' },
        actions: [{ type: 'clickToDestroy', button: 'right', radius: 32 }],
      },
    ],
  }
}

function project(boards: LogicBoard[], path = '/proj/game.artcade'): ProjectDoc {
  return {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1,
        name: 'E',
        className: 'E',
        tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: {
          spriteAssetId: '',
          tint: { x: 1, y: 1, z: 1, w: 1 },
          fillColor: { x: 0.5, y: 0.5, z: 0.5 },
          alpha: 1,
          pivot: { x: 0.5, y: 0.5 },
          renderOrder: 0,
        },
        visible: true,
      },
    },
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [1],
      },
    },
    logicBoards: boards,
  }
}

describe('compileProjectLogic', () => {
  beforeEach(() => clearLogicCompileCache())

  it('returns lua on success', () => {
    const r = compileProjectLogic(project([entityBoard()]))
    expect(r.ok).toBe(true)
    expect(r.lua).toContain('function tick')
    expect(r.compileError).toBeNull()
  })

  it('returns blank main when no boards', () => {
    const r = compileProjectLogic(project([]))
    expect(r.ok).toBe(true)
    expect(r.lua).toBe(BLANK_MAIN_LUA)
  })

  it('fails with compile diagnostic and blank lua when no cache', () => {
    const r = compileProjectLogic(project([invalidGlobalBoard()]), { projectKey: 'a' })
    expect(r.ok).toBe(false)
    expect(r.lua).toBe(BLANK_MAIN_LUA)
    expect(r.compileError).toMatch(/entity rulesheets/)
    expect(r.diagnostics.some((d) => d.source === 'compile' && d.severity === 'error')).toBe(true)
  })

  it('uses last-good lua on second failed compile', () => {
    const key = 'cache-test'
    const ok = compileProjectLogic(project([entityBoard()]), { projectKey: key })
    expect(ok.ok).toBe(true)
    const goodLua = ok.lua

    const fail = compileProjectLogic(project([invalidGlobalBoard()]), { projectKey: key })
    expect(fail.ok).toBe(false)
    expect(fail.lua).toBe(goodLua)
    expect(fail.compileError).toBeTruthy()
  })

  it('isolates cache per projectKey', () => {
    const okA = compileProjectLogic(project([entityBoard()]), { projectKey: 'a' })
    compileProjectLogic(project([invalidGlobalBoard()]), { projectKey: 'b' })
    const failB = compileProjectLogic(project([invalidGlobalBoard()]), { projectKey: 'b' })
    expect(failB.lua).toBe(BLANK_MAIN_LUA)

    const failA = compileProjectLogic(project([invalidGlobalBoard()]), { projectKey: 'a' })
    expect(failA.lua).toBe(okA.lua)
  })

  it('includes config warn diagnostics alongside compile error', () => {
    const board = invalidGlobalBoard()
    const warns = collectConfigDiagnostics(project([board]))
    expect(warns.length).toBeGreaterThan(0)
    expect(warns[0].severity).toBe('warn')

    const r = compileProjectLogic(project([board]))
    expect(r.ok).toBe(false)
    expect(r.diagnostics.some((d) => d.source === 'config' && d.severity === 'warn')).toBe(true)
    expect(r.diagnostics.some((d) => d.source === 'compile')).toBe(true)
  })
})

describe('configDiagnosticsForBoard', () => {
  it('filters warnings for selected board', () => {
    const bad = invalidGlobalBoard()
    const r = compileProjectLogic(project([bad, entityBoard()]))
    const forG1 = configDiagnosticsForBoard(r.diagnostics, 'g1')
    expect(forG1.every((d) => d.boardId === 'g1')).toBe(true)
    expect(formatConfigDiagnosticsSummary(forG1)).toMatch(/entity rulesheets/)
  })
})
