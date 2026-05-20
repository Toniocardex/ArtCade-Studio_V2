import { describe, expect, it } from 'vitest'
import {
  listActionTypes,
  listConditionTypes,
  listTriggerTypes,
  validateAction,
  validateCondition,
  validateConditionNode,
  validateLogicBoard,
  validateLogicBoardDoc,
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
import { createLogicBoard, createLogicEvent } from './factory'
import type { LogicConditionNode } from '../../types/logic-board'

describe('schema-registry', () => {
  it('index lists match options.ts catalogues', () => {
    expect(listTriggerTypes().sort()).toEqual([...TRIGGER_TYPES].sort())
    expect(listActionTypes().sort()).toEqual([...ACTION_TYPES].sort())
    expect(listConditionTypes().sort()).toEqual([...CONDITION_TYPES].sort())
  })

  it('defaultTrigger validates for every trigger type', () => {
    for (const t of TRIGGER_TYPES) {
      const trigger = defaultTrigger(t)
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

  it('minimal board from factory validates', () => {
    const board = createLogicBoard('Player', 'test_board')
    board.events.push(createLogicEvent())
    const r = validateLogicBoard(board)
    expect(r.valid, JSON.stringify(r.errors)).toBe(true)
    const doc = validateLogicBoardDoc([board])
    expect(doc.valid).toBe(true)
  })

  it('rejects unknown action type', () => {
    const r = validateAction({ type: 'notReal', foo: 1 })
    expect(r.valid).toBe(false)
  })

  it('validates nested conditionRoot OR/AND', () => {
    const root: LogicConditionNode = {
      kind: 'group',
      operator: 'OR',
      statements: [
        {
          kind: 'leaf',
          condition: { type: 'compareVariable', key: 'hasKey', operator: '==', value: 1 },
        },
        {
          kind: 'group',
          operator: 'AND',
          statements: [
            {
              kind: 'leaf',
              condition: { type: 'compareVariable', key: 'thief', operator: '==', value: 1 },
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
