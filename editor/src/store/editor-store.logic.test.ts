import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import { createLogicBoard, createLogicEvent } from '../utils/logic-board/factory'
import type { ProjectDoc } from '../types'

function emptyProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    gameResolution: { x: 1280, y: 720 },
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {},
  }
}

function baseState(project: ProjectDoc | null = emptyProject()): CoreState {
  return {
    project,
    projectPath: null,
    projectDirty: false,
    selection: { entityId: null, sceneId: 's' },
    view: 'scene',
    bottomTab: 'assets',
    openScripts: [],
    activeScriptPath: null,
    isPlaying: false, selectedTileCell: 1,
  }
}

describe('coreReducer — Logic Board CRUD', () => {
  it('LOGIC_ADD_BOARD adds a board and marks dirty', () => {
    const board = createLogicBoard('Player', 'pc')
    const s = coreReducer(baseState(), { type: 'LOGIC_ADD_BOARD', board })
    expect(s.project?.logicBoards).toEqual([board])
    expect(s.projectDirty).toBe(true)
  })

  it('LOGIC_ADD_BOARD is idempotent on duplicate boardId', () => {
    const board = createLogicBoard('Player', 'pc')
    let s = coreReducer(baseState(), { type: 'LOGIC_ADD_BOARD', board })
    s = coreReducer(s, { type: 'LOGIC_ADD_BOARD', board: createLogicBoard('Enemy', 'pc') })
    expect(s.project?.logicBoards).toHaveLength(1)
  })

  it('LOGIC_DELETE_BOARD removes by id', () => {
    const a = createLogicBoard('Player', 'a')
    const b = createLogicBoard('Enemy', 'b')
    let s = coreReducer(baseState(), { type: 'LOGIC_ADD_BOARD', board: a })
    s = coreReducer(s, { type: 'LOGIC_ADD_BOARD', board: b })
    s = coreReducer(s, { type: 'LOGIC_DELETE_BOARD', boardId: 'a' })
    expect(s.project?.logicBoards?.map((x) => x.boardId)).toEqual(['b'])
  })

  it('LOGIC_ADD_EVENT / UPDATE_EVENT / DELETE_EVENT operate on the right board', () => {
    const board = createLogicBoard('Player', 'pc')
    let s = coreReducer(baseState(), { type: 'LOGIC_ADD_BOARD', board })

    const evt = createLogicEvent({ type: 'onUpdate' }, [
      { type: 'debugLog', message: 'hi' },
    ])
    s = coreReducer(s, { type: 'LOGIC_ADD_EVENT', boardId: 'pc', event: evt })
    expect(s.project?.logicBoards?.[0].events).toHaveLength(1)

    const updated = { ...evt, enabled: false }
    s = coreReducer(s, { type: 'LOGIC_UPDATE_EVENT', boardId: 'pc', event: updated })
    expect(s.project?.logicBoards?.[0].events[0].enabled).toBe(false)

    s = coreReducer(s, { type: 'LOGIC_DELETE_EVENT', boardId: 'pc', eventId: evt.id })
    expect(s.project?.logicBoards?.[0].events).toHaveLength(0)
  })

  it('CRUD actions are no-ops when no project is open', () => {
    const s = coreReducer(baseState(null), {
      type: 'LOGIC_ADD_BOARD',
      board: createLogicBoard('Player'),
    })
    expect(s.project).toBeNull()
    expect(s.projectDirty).toBe(false)
  })

  it('does not mutate the previous state (immutability)', () => {
    const prev = coreReducer(baseState(), {
      type: 'LOGIC_ADD_BOARD',
      board: createLogicBoard('Player', 'pc'),
    })
    const next = coreReducer(prev, {
      type: 'LOGIC_ADD_EVENT',
      boardId: 'pc',
      event: createLogicEvent(),
    })
    expect(prev.project?.logicBoards?.[0].events).toHaveLength(0)
    expect(next.project?.logicBoards?.[0].events).toHaveLength(1)
    expect(next).not.toBe(prev)
  })
})
