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
    for (const t of [
      'onSpawn', 'onDestroy', 'onCollision', 'onCollisionEnter', 'onCollisionExit',
      'onTriggerEnter', 'onTriggerExit',
      'onAnimationEnd', 'onAnimationStart', 'onAnimationFrame', 'onAnimationLoop', 'onAnimationChange',
      'onObjectClick', 'onObjectHoverEnter', 'onObjectHoverExit',
    ] as const) {
      expect(isTriggerCompatible(t, 'global')).toBe(false)
      expect(isTriggerCompatible(t, 'object_type')).toBe(true)
    }
  })

  it('system + input + message triggers are valid on every target', () => {
    for (const t of ['onStart', 'onUpdate', 'onTimer', 'onInput', 'onMouseInput', 'onMessage', 'onDialogMessage'] as const) {
      expect(isTriggerCompatible(t, 'global')).toBe(true)
      expect(isTriggerCompatible(t, 'object_type')).toBe(true)
    }
  })

  it('matrix is exhaustive — every LogicTriggerType has an entry', () => {
    const expectedTypes = [
      'onStart', 'onUpdate', 'onSpawn', 'onDestroy', 'onHealthDepleted', 'onDamaged',
      'onCollision', 'onCollisionEnter', 'onCollisionExit',
      'onTriggerEnter', 'onTriggerExit',
      'onAnimationEnd', 'onAnimationStart', 'onAnimationFrame', 'onAnimationLoop', 'onAnimationChange',
      'onInput', 'onMouseInput',
      'onObjectClick', 'onObjectHoverEnter', 'onObjectHoverExit',
      'onMessage', 'onDialogMessage', 'onTimer', 'onLeaveScreen',
    ]
    expect(Object.keys(TRIGGER_TARGET_MATRIX).sort()).toEqual(expectedTypes.sort())
  })

  it('onHealthDepleted is entity-only', () => {
    expect(isTriggerCompatible('onHealthDepleted', 'object_type')).toBe(true)
    expect(isTriggerCompatible('onHealthDepleted', 'global')).toBe(false)
  })

  it('allowedTriggersForTarget filters correctly', () => {
    const global = allowedTriggersForTarget('global')
    expect(global).not.toContain('onSpawn')
    expect(global).not.toContain('onCollision')
    expect(global).not.toContain('onObjectClick')
    expect(global).not.toContain('onObjectHoverEnter')
    expect(global).toContain('onInput')
    expect(global).toContain('onStart')

    const objectType = allowedTriggersForTarget('object_type')
    expect(objectType).toContain('onSpawn')
    expect(objectType).toContain('onCollision')
    expect(objectType).toContain('onObjectClick')
    expect(objectType).toContain('onObjectHoverExit')
    expect(objectType).toContain('onInput')
  })
})

describe('board-level compatibility errors', () => {
  it('returns empty list for a valid board', () => {
    const b = mkBoard({
      target: { type: 'object_type', objectTypeId: 'Player' },
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
        { id: 'col1', enabled: true, trigger: { type: 'onCollision', filter: { className: 'Coin' } }, actions: [] },
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
      target: { type: 'object_type', objectTypeId: 'Player' },
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
    expect(eventCompatibilityError(ev, 'object_type')).toBeNull()
  })
  it('returns a human message when not', () => {
    const ev = { id: 'x', enabled: true, trigger: { type: 'onSpawn' as const }, actions: [] }
    const msg = eventCompatibilityError(ev, 'global')
    expect(msg).toMatch(/onSpawn/)
    expect(msg).toMatch(/global/)
  })
})
