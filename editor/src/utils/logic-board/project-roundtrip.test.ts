import { describe, it, expect } from 'vitest'
import { parseProjectDoc, serializeProjectDoc } from '../project'
import { parseLogicBoards } from './factory'
import type { LogicBoard } from '../../types/logic-board'

const SAMPLE_BOARD: LogicBoard = {
  boardId: 'player_controller',
  target: { type: 'entity_class', className: 'Player' },
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
  gameResolution: [1280, 720],
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
        target: { type: 'entity_class', className: 'P' },
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
        gameResolution: [1280, 720],
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
