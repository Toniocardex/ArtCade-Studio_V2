import { describe, expect, it } from 'vitest'
import { compileLogicBoard } from './compiler'
import { formatGeneratedLogicLuaPreview } from './generated-lua-preview'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'

function ev(partial: Partial<LogicEvent> & Pick<LogicEvent, 'trigger' | 'actions'>): LogicEvent {
  return { id: 'press_w', enabled: true, ...partial }
}

function projectWithPlayer(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1,
        name: 'Hero',
        className: 'Player',
        tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
      },
    },
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 1280, y: 720 },
        viewportSize: { x: 1280, y: 720 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [1],
      },
    },
  } as ProjectDoc
}

describe('formatGeneratedLogicLuaPreview', () => {
  it('hides runtime scaffolding from simple generated input rules', () => {
    const board: LogicBoard = {
      boardId: 'b1',
      name: 'Object rules',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [
        ev({
          trigger: { type: 'onInput', keyCode: 'KeyW', eventType: 'pressed' },
          actions: [{ type: 'moveController', target: 'self', direction: 'up' }],
        }),
      ],
    }
    const lua = compileLogicBoard([board], projectWithPlayer())
    const preview = formatGeneratedLogicLuaPreview(lua)

    expect(preview).toContain('-- board: Object rules')
    expect(preview).toContain('input.onPressed("KeyW", function()')
    expect(preview).toContain('for _, self in ipairs({ 1 }) do')
    expect(preview).toContain('movement.setIntent(self, 0, -1)')
    expect(preview).not.toContain('local __artcade_logic')
    expect(preview).not.toContain('_logic_track')
    expect(preview).not.toContain('_logic_bag_unsub')
    expect(preview).not.toContain('_logic_reg_input_pressed')
    expect(preview).not.toContain('_logic_on')
    expect(preview).not.toContain('module.dispose')
    expect(preview).not.toContain('local other = nil')
  })
})
