import { describe, expect, it } from 'vitest'
import { parseProjectDoc, serializeProjectDoc } from './project'
import {
  createArcadeNoPhysicsProject,
  createPlatformerProject,
  createProjectFromTemplate,
} from './project-templates'

describe('project templates', () => {
  it('arcade template disables world physics and has no player physics', () => {
    const doc = createArcadeNoPhysicsProject('Flappy')
    expect(doc.world?.physicsMode).toBe('off')
    expect(doc.entities[1].physics).toBeUndefined()
    expect(doc.entities[1].linearMover).toBeDefined()
    const roundTrip = parseProjectDoc(serializeProjectDoc(doc))
    expect(roundTrip!.world?.physicsMode).toBe('off')
  })

  it('platformer template ships player + solid ground', () => {
    const doc = createPlatformerProject('Jump')
    expect(doc.world?.physicsMode).toBe('auto')
    expect(doc.entities[1].platformerController?.groundClass).toBe('Ground')
    expect(doc.entities[2].solid?.groundClass).toBe('Ground')
    expect(doc.scenes.scene_main.entityIds).toEqual([1, 2])
    expect(doc.entities[1].physics).toBeUndefined()
  })

  it('createProjectFromTemplate dispatches by id', () => {
    expect(createProjectFromTemplate('blank').entities).toEqual({})
    expect(createProjectFromTemplate('arcade').world?.physicsMode).toBe('off')
    expect(createProjectFromTemplate('platformer').entities[2].solid).toBeDefined()
  })
})
