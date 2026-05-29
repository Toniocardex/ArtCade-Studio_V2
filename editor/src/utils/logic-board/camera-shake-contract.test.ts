/**
 * Documents the editor ↔ WASM contract for Camera shake.
 * C++ applies shake in renderActiveScene; trauma refresh must run even in
 * edit mode when Logic Board hot-reload calls camera.shake from _logic_init.
 */
import { describe, expect, it } from 'vitest'
import { compileLogicBoard } from './compiler'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'

function board(events: LogicEvent[], className = 'Player'): LogicBoard {
  return { boardId: 'b1', target: { type: 'entity_class', className }, events }
}

function ev(partial: Partial<LogicEvent> & Pick<LogicEvent, 'trigger' | 'actions'>): LogicEvent {
  return { id: 'e1', enabled: true, ...partial }
}

describe('camera shake compile contract', () => {
  it('onStart cameraShake is emitted before tick and may run on script load', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onStart' },
          actions: [{ type: 'cameraShake', trauma: 0.75 }],
        }),
      ]),
    ])
    expect(lua).toMatch(/camera\.shake\(0\.75, 0\.5\)/)
    expect(lua.indexOf('camera.shake(0.75, 0.5)')).toBeLessThan(lua.indexOf('function tick(dt)'))
    expect(lua).toContain('if not __artcade_requires_tick and not _init_done then')
  })

  it('onUpdate cameraShake stays in tick path', () => {
    const lua = compileLogicBoard([
      board([
        ev({
          trigger: { type: 'onUpdate' },
          actions: [{ type: 'cameraShake', trauma: 0.4 }],
        }),
      ]),
    ])
    expect(lua).toContain('__artcade_requires_tick = true')
    const tickIdx = lua.indexOf('function tick(dt)')
    const shakeIdx = lua.indexOf('camera.shake(0.4, 0.5)')
    expect(shakeIdx).toBeGreaterThan(tickIdx)
  })
})
