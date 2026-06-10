/**
 * Regression: camera.shake inside Repeat (nested actions) on onInput must compile.
 */
import { describe, expect, it } from 'vitest'
import { compileLogicBoard } from './compiler'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'

function board(events: LogicEvent[]): LogicBoard {
  return { boardId: 'b1', target: { type: 'object_type', objectTypeId: 'Entity_1' }, events }
}

function ev(partial: Partial<LogicEvent> & Pick<LogicEvent, 'trigger' | 'actions'>): LogicEvent {
  return { id: 'e1', enabled: true, ...partial }
}

describe('camera shake in repeat + onInput', () => {
  it('emits camera.shake and debug.log in timed repeat step (nested actions)', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
          actions: [
            {
              type: 'repeatTimes',
              count: 5,
              intervalSeconds: 2,
              actions: [
                { type: 'cameraShake', trauma: 1 },
                { type: 'debugLog', message: 'Message_test' },
              ],
            },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('camera.shake(1, 0.5)')
    expect(lua).toContain('debug.log("Message_test")')
    const stepIdx = lua.indexOf('local function _logic_rep_step_1(n)')
    const shakeIdx = lua.indexOf('camera.shake(1, 0.5)')
    const logIdx = lua.indexOf('debug.log("Message_test")')
    expect(stepIdx).toBeGreaterThan(-1)
    expect(shakeIdx).toBeGreaterThan(stepIdx)
    expect(logIdx).toBeGreaterThan(shakeIdx)
  })

  it('emits camera.shake in timed repeat step (flat actions below Repeat)', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
          actions: [
            { type: 'repeatTimes', count: 5, intervalSeconds: 2 },
            { type: 'cameraShake', trauma: 1 },
            { type: 'debugLog', message: 'Message_test' },
          ],
        }),
      ]),
    ])
    expect(lua).toContain('camera.shake(1, 0.5)')
    expect(lua).toContain('debug.log("Message_test")')
  })
})
