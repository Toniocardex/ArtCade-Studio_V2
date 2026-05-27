import { describe, expect, it } from 'vitest'
import { repeatBodyIndices } from './repeat-body-indices'
import type { LogicAction } from '../../types/logic-board'

describe('repeatBodyIndices', () => {
  it('marks following actions until wait or repeat', () => {
    const actions: LogicAction[] = [
      { type: 'repeatTimes', count: 5, intervalSeconds: 0.5 },
      { type: 'cameraShake', trauma: 0.5 },
      { type: 'debugLog', message: 'after' },
    ]
    expect(repeatBodyIndices(actions)).toEqual(new Set([1, 2]))
  })

  it('stops at the next wait', () => {
    const actions: LogicAction[] = [
      { type: 'repeatTimes', count: 2, intervalSeconds: 0 },
      { type: 'debugLog', message: 'in' },
      { type: 'wait', seconds: 1 },
      { type: 'debugLog', message: 'out' },
    ]
    expect(repeatBodyIndices(actions)).toEqual(new Set([1]))
  })
})
