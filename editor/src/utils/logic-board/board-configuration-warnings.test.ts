import { describe, expect, it } from 'vitest'
import type { LogicBoard } from '../../types/logic-board'
import { boardConfigurationSummary, boardConfigurationWarnings } from './board-configuration-warnings'

describe('boardConfigurationWarnings', () => {
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
    const warnings = boardConfigurationWarnings(board)
    expect(warnings.some((w) => /Else branch/.test(w))).toBe(true)
    expect(boardConfigurationSummary(board)).toBeTruthy()
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
    expect(boardConfigurationWarnings(board).some((w) => /not allowed/.test(w))).toBe(true)
  })
})
