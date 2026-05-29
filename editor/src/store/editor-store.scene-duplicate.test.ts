import { describe, expect, it } from 'vitest'
import { coreReducer, initialCoreState } from './editor-store'
import { createBlankProject } from '../utils/project-factory'
import { createEntityDef } from '../utils/project-builders'
import { createLogicBoardForEntity } from '../utils/logic-board/factory'

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

  it('clones entity_id logic boards onto duplicated entities', () => {
    const p = createBlankProject()
    p.entities[1] = createEntityDef(1, 'Hero', 'Player')
    p.scenes.scene_main.entityIds = [1]
    p.logicBoards = [createLogicBoardForEntity(1, 'board_hero')]
    const next = coreReducer(st(p), { type: 'SCENE_DUPLICATE', sceneId: 'scene_main' })
    const newSceneId = next.selection.sceneId!
    const clonedEid = next.project!.scenes[newSceneId].entityIds[0]
    const boards = next.project!.logicBoards ?? []
    expect(boards).toHaveLength(2)
    const clonedBoard = boards.find(
      (b) => b.target.type === 'entity_id' && b.target.entityId === clonedEid,
    )
    expect(clonedBoard).toBeDefined()
    expect(clonedBoard!.boardId).not.toBe('board_hero')
    const originalBoard = boards.find((b) => b.boardId === 'board_hero')
    expect(originalBoard?.target.entityId).toBe(1)
  })
})
