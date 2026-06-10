import { describe, expect, it, beforeEach } from 'vitest'
import type { LogicBoard } from '../../types/logic-board'
import { compileLogicBoardLuaOrBlank, compileLogicBoardSafe } from './compile-logic-board-safe'
import { clearLogicCompileCache } from './logic-compile-service'
import { BLANK_MAIN_LUA } from '../project-factory'

describe('compileLogicBoardSafe', () => {
  beforeEach(() => clearLogicCompileCache())
  it('returns lua on success', () => {
    const board: LogicBoard = {
      boardId: 'b1',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [],
    }
    const r = compileLogicBoardSafe([board])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.lua).toContain('function tick')
  })

  it('returns error string instead of throwing', () => {
    const board: LogicBoard = {
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
    const r = compileLogicBoardSafe([board])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/entity rulesheets/)
  })

  it('compileLogicBoardLuaOrBlank returns blank main on failure', () => {
    const board = {
      boardId: 'g1',
      target: { type: 'global' as const },
      events: [{
        id: 'e1',
        enabled: true,
        trigger: { type: 'onMouseInput' as const, button: 'right' as const, eventType: 'pressed' as const },
        actions: [{ type: 'clickToDestroy' as const, button: 'right' as const, radius: 32 }],
      }],
    }
    const { lua, error } = compileLogicBoardLuaOrBlank([board], null, { projectKey: 'safe-test' })
    expect(lua).toBe(BLANK_MAIN_LUA)
    expect(error).toMatch(/entity rulesheets/)
  })
})
