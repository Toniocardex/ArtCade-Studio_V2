import { describe, it, expect } from 'vitest'
import {
  TRIGGER_TARGET_MATRIX,
  allowedTriggersForTarget,
  assertBoardCompatible,
  eventCompatibilityError,
  findBoardCompatibilityErrors,
  isTriggerCompatible,
} from './trigger-compatibility'
import { compileLogicBoard } from './compiler'
import type { LogicBoard } from '../../types/logic-board'

function mkBoard(partial: Partial<LogicBoard> & Pick<LogicBoard, 'target' | 'events'>): LogicBoard {
  return { boardId: 'b1', ...partial }
}

describe('trigger-compatibility matrix', () => {
  it('lifecycle/physics/animation triggers reject global boards', () => {
    for (const t of ['onSpawn', 'onDestroy', 'onCollision', 'onTriggerEnter', 'onTriggerExit', 'onAnimationEnd'] as const) {
      expect(isTriggerCompatible(t, 'global')).toBe(false)
      expect(isTriggerCompatible(t, 'entity_class')).toBe(true)
      expect(isTriggerCompatible(t, 'entity_id')).toBe(true)
    }
  })

  it('system + input + message triggers are valid on every target', () => {
    for (const t of ['onStart', 'onUpdate', 'onTimer', 'onInput', 'onMouseInput', 'onMessage'] as const) {
      expect(isTriggerCompatible(t, 'global')).toBe(true)
      expect(isTriggerCompatible(t, 'entity_class')).toBe(true)
      expect(isTriggerCompatible(t, 'entity_id')).toBe(true)
    }
  })

  it('matrix is exhaustive — every LogicTriggerType has an entry', () => {
    const expectedTypes = [
      'onStart', 'onUpdate', 'onSpawn', 'onDestroy',
      'onCollision', 'onTriggerEnter', 'onTriggerExit',
      'onAnimationEnd', 'onInput', 'onMouseInput', 'onMessage', 'onTimer',
    ]
    expect(Object.keys(TRIGGER_TARGET_MATRIX).sort()).toEqual(expectedTypes.sort())
  })

  it('allowedTriggersForTarget filters correctly', () => {
    const global = allowedTriggersForTarget('global')
    expect(global).not.toContain('onSpawn')
    expect(global).not.toContain('onCollision')
    expect(global).toContain('onInput')
    expect(global).toContain('onStart')

    const entityClass = allowedTriggersForTarget('entity_class')
    expect(entityClass).toContain('onSpawn')
    expect(entityClass).toContain('onCollision')
    expect(entityClass).toContain('onInput')
  })
})

describe('board-level compatibility errors', () => {
  it('returns empty list for a valid board', () => {
    const b = mkBoard({
      target: { type: 'entity_class', className: 'Player' },
      events: [
        { id: 'e1', enabled: true, trigger: { type: 'onSpawn' }, actions: [] },
      ],
    })
    expect(findBoardCompatibilityErrors(b)).toEqual([])
  })

  it('flags every offending event individually', () => {
    const b = mkBoard({
      target: { type: 'global' },
      events: [
        { id: 'spawn1', enabled: true, trigger: { type: 'onSpawn' }, actions: [] },
        { id: 'input1', enabled: true, trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' }, actions: [] },
        { id: 'col1', enabled: true, trigger: { type: 'onCollision', withClass: 'Coin' }, actions: [] },
      ],
    })
    const errs = findBoardCompatibilityErrors(b)
    expect(errs.map((e) => e.eventId).sort()).toEqual(['col1', 'spawn1'])
  })
})

describe('compiler integration', () => {
  it('compileLogicBoard throws on incompatible trigger/target combos', () => {
    const b = mkBoard({
      target: { type: 'global' },
      events: [
        { id: 'spawn1', enabled: true, trigger: { type: 'onSpawn' }, actions: [] },
      ],
    })
    expect(() => compileLogicBoard([b])).toThrow(/onSpawn is not allowed/)
  })

  it('assertBoardCompatible is a noop for valid boards', () => {
    const b = mkBoard({
      target: { type: 'entity_class', className: 'Player' },
      events: [
        { id: 'e1', enabled: true, trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' }, actions: [] },
      ],
    })
    expect(() => assertBoardCompatible(b)).not.toThrow()
  })
})

describe('eventCompatibilityError (single-event UI surface)', () => {
  it('returns null when compatible', () => {
    const ev = { id: 'x', enabled: true, trigger: { type: 'onSpawn' as const }, actions: [] }
    expect(eventCompatibilityError(ev, 'entity_class')).toBeNull()
  })
  it('returns a human message when not', () => {
    const ev = { id: 'x', enabled: true, trigger: { type: 'onSpawn' as const }, actions: [] }
    const msg = eventCompatibilityError(ev, 'global')
    expect(msg).toMatch(/onSpawn/)
    expect(msg).toMatch(/global/)
  })
})
