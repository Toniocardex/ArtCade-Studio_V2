import { describe, expect, it } from 'vitest'
import { coreReducer, initialCoreState } from './editor-store'
import { createBlankProject } from '../utils/project-factory'
import { createEntityDef } from '../utils/project-builders'
import { createLogicBoardForObjectType } from '../utils/logic-board/factory'

function st(project = createBlankProject()) {
  return { ...initialCoreState, project, selection: { sceneId: 'scene_main', entityId: 1 } }
}

describe('SCENE_DUPLICATE', () => {
  it('clones entities into a new scene without changing start scene', () => {
    const p = createBlankProject()
    p.entities[1] = createEntityDef(1, 'Hero', 'Player')
    p.scenes.scene_main.entityIds = [1]
    const next = coreReducer(st(p), { type: 'SCENE_DUPLICATE', sceneId: 'scene_main' })
    const newId = next.selection.sceneId
    expect(newId).not.toBe('scene_main')
    expect(next.project!.activeSceneId).toBe('scene_main')
    expect(next.project!.scenes[newId!].entityIds).toHaveLength(1)
    const clonedEid = next.project!.scenes[newId!].entityIds[0]
    expect(next.project!.entities[clonedEid].name).toBe('Hero')
    expect(clonedEid).not.toBe(1)
  })

  it('does not clone type boards — the shared board already covers new instances', () => {
    const p = createBlankProject()
    p.entities[1] = createEntityDef(1, 'Hero', 'Player')
    p.scenes.scene_main.entityIds = [1]
    p.logicBoards = [createLogicBoardForObjectType('Player', 'board_hero')]
    const next = coreReducer(st(p), { type: 'SCENE_DUPLICATE', sceneId: 'scene_main' })
    const boards = next.project!.logicBoards ?? []
    expect(boards).toHaveLength(1)
    expect(boards[0].boardId).toBe('board_hero')
    expect(boards[0].target).toEqual({ type: 'object_type', objectTypeId: 'Player' })
  })
})
