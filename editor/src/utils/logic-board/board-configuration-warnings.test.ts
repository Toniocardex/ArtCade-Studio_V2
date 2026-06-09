import { describe, expect, it } from 'vitest'
import type { LogicBoard } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { collectConfigDiagnostics, formatConfigDiagnosticsSummary } from './logic-compile-service'

function projectWithBoard(board: LogicBoard): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's1',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: { s1: { id: 's1', name: 'S1', entityIds: [] } },
    logicBoards: [board],
  }
}

function boardWarnings(board: LogicBoard): string[] {
  return collectConfigDiagnostics(projectWithBoard(board))
    .filter((d) => d.boardId === board.boardId)
    .map((d) => d.message)
}

describe('collectConfigDiagnostics (board configuration)', () => {
  it('reports clickToDestroy in Else', () => {
    const board: LogicBoard = {
      boardId: 'b1',
      target: { type: 'entity_id', entityId: 1 },
      events: [{
        id: 'e1',
        enabled: true,
        trigger: { type: 'onObjectClick', button: 'right', radius: 32 },
        onlyIfEnabled: true,
        elseEnabled: true,
        actions: [{ type: 'clickToDestroy', button: 'right', radius: 32 }],
        elseActions: [{ type: 'clickToDestroy', button: 'right', radius: 32 }],
      }],
    }
    const warnings = boardWarnings(board)
    expect(warnings.some((w) => /Else branch/.test(w))).toBe(true)
    expect(formatConfigDiagnosticsSummary(collectConfigDiagnostics(projectWithBoard(board)))).toBeTruthy()
  })

  it('reports incompatible trigger on global board', () => {
    const board: LogicBoard = {
      boardId: 'g1',
      target: { type: 'global' },
      events: [{
        id: 'e1',
        enabled: true,
        trigger: { type: 'onObjectClick', button: 'left', radius: 32 },
        actions: [{ type: 'debugLog', message: 'x' }],
      }],
    }
    expect(boardWarnings(board).some((w) => /not allowed/.test(w))).toBe(true)
  })
})
