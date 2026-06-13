import { describe, expect, it } from 'vitest'
import {
  listActionTypes,
  listConditionTypes,
  listTriggerTypes,
  validateAction,
  validateActionTree,
  validateCondition,
  validateConditionNode,
  validateLogicBoard,
  validateLogicBoardDoc,
  validateActionTree,
  validateLogicEvent,
  validateTrigger,
} from './schema-registry'
import {
  ACTION_TYPES,
  CONDITION_TYPES,
  TRIGGER_TYPES,
  defaultAction,
  defaultCondition,
  defaultTrigger,
} from '../../panels/logic-board/options'
import { createLogicBoardForObjectType, createLogicEvent } from './factory'
import type { LogicConditionNode } from '../../types/logic-board'

describe('schema-registry', () => {
  it('index lists match options.ts catalogues', () => {
    expect(listTriggerTypes().sort()).toEqual([...TRIGGER_TYPES].sort())
    expect(listActionTypes().sort()).toEqual([...ACTION_TYPES].sort())
    expect(listConditionTypes().sort()).toEqual([...CONDITION_TYPES].sort())
  })

  it('defaultTrigger validates for every trigger type (after filling required user inputs)', () => {
    // Some triggers have required user-supplied params (withClass, clipName)
    // that the UI deliberately leaves empty in the default so the event editor
    // surfaces a "needs config" state. For schema validation we hydrate
    // those placeholders here.
    const fillRequired = (t: ReturnType<typeof defaultTrigger>) => {
      const o = t as Record<string, unknown>
      if ('withClass' in o && o.withClass === '') o.withClass = 'PlaceholderClass'
      if ('clipName' in o && o.clipName === '') o.clipName = 'placeholder_clip'
      return t
    }
    for (const t of TRIGGER_TYPES) {
      const trigger = fillRequired(defaultTrigger(t))
      const r = validateTrigger(trigger)
      expect(r.valid, `${t}: ${JSON.stringify(r.errors)}`).toBe(true)
    }
  })

  it('defaultAction validates for every action type', () => {
    for (const t of ACTION_TYPES) {
      const action = defaultAction(t)
      const r = validateAction(action)
      expect(r.valid, `${t}: ${JSON.stringify(r.errors)}`).toBe(true)
    }
  })

  it('defaultCondition validates for every condition type', () => {
    for (const t of CONDITION_TYPES) {
      const cond = defaultCondition(t)
      const r = validateCondition(cond)
      expect(r.valid, `${t}: ${JSON.stringify(r.errors)}`).toBe(true)
    }
  })

  it('hides duplicate legacy components while preserving saved-project validation', () => {
    expect(ACTION_TYPES).not.toContain('setVariableRandomRange')
    expect(ACTION_TYPES).not.toContain('clickToDestroy')
    expect(ACTION_TYPES).not.toContain('clearMovementIntent')
    expect(ACTION_TYPES).not.toContain('setCameraTarget')
    expect(ACTION_TYPES).toContain('centerCameraOn')
    expect(ACTION_TYPES).toContain('followCamera')
    expect(ACTION_TYPES).toContain('stopCameraFollow')
    expect(CONDITION_TYPES).not.toContain('isSpaceFree')
    expect(CONDITION_TYPES).toContain('isTileAreaFree')

    expect(validateAction({ type: 'setVariableRandomRange', key: 'die', min: 1, max: 6 }).valid).toBe(true)
    expect(validateAction({ type: 'setCameraTarget', target: 'self' }).valid).toBe(true)
    expect(validateCondition({ type: 'isSpaceFree', x: 0, y: 0, w: 32, h: 32 }).valid).toBe(true)
  })

  it('validates typed Value Sources', () => {
    expect(validateAction({
      type: 'setGlobalVariable',
      key: 'x',
      value: { source: 'entity', target: 'self', property: 'positionX' },
    }).valid).toBe(true)
    expect(validateCondition({
      type: 'compareValues',
      left: { source: 'global', key: 'score' },
      operator: '>=',
      right: { source: 'message', key: 'minimum', fallback: 0 },
    }).valid).toBe(true)
    expect(validateCondition({
      type: 'compareValues',
      left: {
        source: 'expression',
        initial: { source: 'entity', target: 'self', property: 'healthCurrent' },
        operations: [
          { operator: 'divide', value: { source: 'entity', target: 'self', property: 'healthMax' } },
          { operator: 'multiply', value: 100 },
        ],
      },
      operator: '<=',
      right: 25,
    }).valid).toBe(true)
  })

  it('minimal board from factory validates', () => {
    const board = createLogicBoardForObjectType('Player', 'test_board')
    board.events.push(createLogicEvent())
    const r = validateLogicBoard(board)
    expect(r.valid, JSON.stringify(r.errors)).toBe(true)
    const doc = validateLogicBoardDoc([board])
    expect(doc.valid).toBe(true)
  })

  it('validateLogicBoard rejects unknown trigger types', () => {
    const board = createLogicBoardForObjectType('Player', 'test_board')
    board.events.push(createLogicEvent())
    board.events[0]!.trigger = { type: 'notARealTrigger' } as never
    const r = validateLogicBoard(board)
    expect(r.valid).toBe(false)
  })

  it('schema rejects triggers missing required user params', () => {
    // These reflect the tightened triggers.json — required+minLength.
    expect(validateTrigger({ type: 'onCollision' }).valid).toBe(false)
    expect(validateTrigger({ type: 'onCollision', withClass: '' }).valid).toBe(false)
    expect(validateTrigger({ type: 'onTriggerEnter' }).valid).toBe(false)
    expect(validateTrigger({ type: 'onTriggerExit' }).valid).toBe(false)
    expect(validateTrigger({ type: 'onAnimationEnd' }).valid).toBe(false)
    expect(validateTrigger({ type: 'onAnimationEnd', clipName: '' }).valid).toBe(false)
    expect(validateTrigger({ type: 'onMessage', messageName: '' }).valid).toBe(false)
    expect(validateTrigger({ type: 'onInput', keyCode: '', eventType: 'pressed' }).valid).toBe(false)
    expect(validateTrigger({ type: 'onTimer', seconds: 0, repeat: false }).valid).toBe(false)
    expect(validateTrigger({ type: 'onTimer', seconds: -1, repeat: false }).valid).toBe(false)
    // onSpawn must no longer accept a className (derived from board.target).
    expect(validateTrigger({ type: 'onSpawn', className: 'Player' }).valid).toBe(false)
  })

  it('rejects unknown action type', () => {
    const r = validateAction({ type: 'notReal', foo: 1 })
    expect(r.valid).toBe(false)
  })

  it('reports only the selected schema branch for invalid known actions', () => {
    const r = validateAction({ type: 'setLinearMoverSpeed', target: 'self' })
    expect(r.valid).toBe(false)
    expect(r.errors.some((error) => error.message.includes('speed'))).toBe(true)
    expect(r.errors.length).toBeLessThan(6)
  })

  it('validates nested conditionRoot OR/AND', () => {
    const root: LogicConditionNode = {
      kind: 'group',
      operator: 'OR',
      statements: [
        {
          kind: 'leaf',
          condition: { type: 'compareValues', left: { source: 'global', key: 'hasKey' }, operator: '==', right: 1 },
        },
        {
          kind: 'group',
          operator: 'AND',
          statements: [
            {
              kind: 'leaf',
              condition: { type: 'compareValues', left: { source: 'global', key: 'thief' }, operator: '==', right: 1 },
            },
            {
              kind: 'leaf',
              condition: { type: 'isKeyDown', keyCode: 'Space' },
            },
          ],
        },
      ],
    }
    expect(validateConditionNode(root).valid).toBe(true)
    const ev = createLogicEvent({ type: 'onUpdate' }, [])
    ev.conditionRoot = root
    expect(validateLogicEvent(ev).valid).toBe(true)
  })

  it('rejects leaf without condition', () => {
    const r = validateConditionNode({ kind: 'leaf' })
    expect(r.valid).toBe(false)
  })
})

describe('validateActionTree', () => {
  it('validates nested wait.then actions', () => {
    const r = validateActionTree(
      {
        type: 'wait',
        seconds: 1,
        then: [{ type: 'debugLog', message: 'ok' }],
      },
      '/actions[0]',
    )
    expect(r.valid).toBe(true)
  })

  it('rejects invalid nested wait.then actions', () => {
    const r = validateActionTree(
      {
        type: 'wait',
        seconds: 1,
        then: [{ type: 'not_a_real_action' }],
      },
      '/actions[0]',
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.path.includes('/then[0]'))).toBe(true)
  })
})
