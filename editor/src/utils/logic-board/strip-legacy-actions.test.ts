import { describe, expect, it } from 'vitest'
import { stripLegacyLogicActions } from './strip-legacy-actions'
import { parseLogicBoards } from './factory'

describe('stripLegacyLogicActions', () => {
  it('removes preventDefault actions from saved projects', () => {
    const out = stripLegacyLogicActions([
      { type: 'preventDefault', button: 'right' },
      { type: 'destroyEntity', target: 'self' },
    ])
    expect(out).toEqual([{ type: 'destroyEntity', target: 'self' }])
  })

  it('converts duplicate legacy actions to canonical forms', () => {
    const out = stripLegacyLogicActions([
      { type: 'setVariableRandomRange', key: 'die', min: 1, max: 6 },
      { type: 'clearMovementIntent', target: 'self' },
      { type: 'setCameraTarget', target: 'self' },
    ])
    expect(out).toEqual([
      { type: 'setVariable', key: 'die', value: { source: 'random', min: 1, max: 6 } },
      { type: 'moveController', target: 'self', direction: 'stop' },
      { type: 'centerCameraOn', target: 'self' },
    ])
  })

  it('migrates legacy event recipes while loading a saved board', () => {
    const boards = parseLogicBoards([{
      boardId: 'legacy',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [{
        id: 'click',
        enabled: true,
        trigger: { type: 'onStart' },
        conditions: [{ type: 'isSpaceFree', x: 0, y: 0, w: 32, h: 32 }],
        actions: [{ type: 'clickToDestroy', button: 'right', radius: 24 }],
      }],
    }])
    expect(boards?.[0]?.events[0]).toMatchObject({
      trigger: { type: 'onObjectClick', button: 'right', radius: 24 },
      conditions: [{ type: 'isTileAreaFree' }],
      actions: [{ type: 'destroyEntity', target: 'self' }],
    })
  })
})
