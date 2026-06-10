import { describe, it, expect } from 'vitest'
import { parseProjectDoc, serializeProjectDoc } from '../project'
import { parseLogicBoards, parseLogicBoardsWithIssues } from './factory'
import type { LogicBoard } from '../../types/logic-board'

const SAMPLE_BOARD: LogicBoard = {
  boardId: 'player_controller',
  target: { type: 'object_type', objectTypeId: 'Player' },
  events: [
    {
      id: 'jump',
      enabled: true,
      trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
      actions: [{ type: 'setVelocity', target: 'self', vx: 0, vy: -400 }],
    },
    {
      id: 'coin',
      enabled: true,
      trigger: { type: 'onCollision', withClass: 'Coin' },
      conditions: [{ type: 'compareVariable', key: 'alive', operator: '==', value: 1 }],
      actions: [
        { type: 'addVariable', key: 'coins', amount: 1 },
        { type: 'playSound', path: 'sfx/coin.ogg' },
      ],
    },
  ],
}

const BASE_JSON = JSON.stringify({
  projectName: 'RT',
  version: '2.0.0',
  targetFPS: 60,
  activeSceneId: 'scene_main',
  mainScriptPath: 'scripts/main.lua',
  entities: {},
  scenes: { scene_main: { id: 'scene_main', name: 'Main', entityIds: [] } },
  logicBoards: [SAMPLE_BOARD],
})

describe('parseLogicBoards — defensive', () => {
  it('returns undefined for non-array / empty', () => {
    expect(parseLogicBoards(undefined)).toBeUndefined()
    expect(parseLogicBoards('nope')).toBeUndefined()
    expect(parseLogicBoards([])).toBeUndefined()
  })

  it('drops boards without a boardId and events without a trigger', () => {
    const boards = parseLogicBoards([
      { target: {}, events: [] }, // no boardId → dropped
      {
        boardId: 'ok',
        target: { type: 'object_type', objectTypeId: 'P' },
        events: [
          { id: 'a', trigger: { type: 'onUpdate' }, actions: [] }, // kept
          { id: 'b', actions: [] }, // no trigger → dropped
        ],
      },
    ])
    expect(boards).toHaveLength(1)
    expect(boards?.[0].boardId).toBe('ok')
    expect(boards?.[0].events).toHaveLength(1)
  })

  it('keeps schema-invalid events and records load issues', () => {
    const { doc, issues } = parseLogicBoardsWithIssues([
      {
        boardId: 'broken',
        target: { type: 'object_type', objectTypeId: 'P' },
        events: [
          {
            id: 'bad',
            enabled: true,
            trigger: { type: 'onUpdate' },
            actions: [{ type: 'not_a_real_action_type' }],
          },
        ],
      },
    ])
    expect(doc).toHaveLength(1)
    expect(doc?.[0].events).toHaveLength(1)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0].boardId).toBe('broken')
  })

  it('rejects boards with legacy entity_id / entity_class targets (no compat)', () => {
    const { doc, issues } = parseLogicBoardsWithIssues([
      {
        boardId: 'legacy_instance',
        target: { type: 'entity_id', entityId: 7 },
        events: [{ id: 'e', trigger: { type: 'onUpdate' }, actions: [] }],
      },
      {
        boardId: 'legacy_class',
        target: { type: 'entity_class', className: 'Coin' },
        events: [{ id: 'e', trigger: { type: 'onUpdate' }, actions: [] }],
      },
      {
        boardId: 'ok',
        target: { type: 'object_type', objectTypeId: 'Coin' },
        events: [{ id: 'e', trigger: { type: 'onUpdate' }, actions: [] }],
      },
    ])
    expect(doc).toHaveLength(1)
    expect(doc?.[0].boardId).toBe('ok')
    expect(issues.map((i) => i.boardId).sort()).toEqual(['legacy_class', 'legacy_instance'])
  })

  it('defaults enabled to true when omitted', () => {
    const boards = parseLogicBoards([
      {
        boardId: 'b',
        target: {},
        events: [{ id: 'e', trigger: { type: 'onUpdate' }, actions: [] }],
      },
    ])
    expect(boards?.[0].events[0].enabled).toBe(true)
  })
})

describe('project.json roundtrip with logicBoards', () => {
  it('parses logicBoards into the ProjectDoc', () => {
    const p = parseProjectDoc(BASE_JSON)
    expect(p).not.toBeNull()
    expect(p?.logicBoards).toHaveLength(1)
    expect(p?.logicBoards?.[0].events).toHaveLength(2)
  })

  it('serialize → parse preserves the boards', () => {
    const p = parseProjectDoc(BASE_JSON)!
    const json = serializeProjectDoc(p)
    const again = parseProjectDoc(json)!
    expect(again.logicBoards).toEqual(p.logicBoards)
  })

  it('omits logicBoards key entirely when there are none', () => {
    const p = parseProjectDoc(
      JSON.stringify({
        projectName: 'NB',
        version: '2.0.0',
        targetFPS: 60,
        activeSceneId: 's',
        mainScriptPath: 'scripts/main.lua',
        entities: {},
        scenes: { s: { id: 's', name: 'S', entityIds: [] } },
      }),
    )!
    expect(p.logicBoards).toBeUndefined()
    expect(serializeProjectDoc(p)).not.toContain('logicBoards')
  })
})
