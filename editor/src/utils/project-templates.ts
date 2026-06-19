import type { ProjectDoc } from '../types'
import { DEFAULT_WORLD } from '../types'
import { createBlankProject } from './project-factory'
import { createEntityDef } from './project-builders'
import { migrateLegacyProject } from './project-object-types'

export type ProjectTemplateId = 'blank' | 'arcade' | 'platformer'

export const PROJECT_TEMPLATE_LABELS: Record<ProjectTemplateId, string> = {
  blank:      'Blank',
  arcade:     'Arcade (no physics)',
  platformer: 'Platformer',
}

/**
 * Starter projects aligned with PHYSICS_OPTIONAL_INTEGRATION_PLAN Fase 5.
 * All templates are valid ProjectDoc values (round-trip via project codec).
 */
export function createProjectFromTemplate(
  template: ProjectTemplateId,
  projectName?: string,
): ProjectDoc {
  switch (template) {
    case 'arcade':
      return createArcadeNoPhysicsProject(projectName)
    case 'platformer':
      return createPlatformerProject(projectName)
    case 'blank':
    default:
      return createBlankProject(projectName ?? 'Untitled')
  }
}

/** Flappy / arcade: transform-only movement, world.physicsMode off. */
export function createArcadeNoPhysicsProject(projectName = 'Arcade Game'): ProjectDoc {
  const base = createBlankProject(projectName)
  const player = createEntityDef(1, 'Player', 'Player', { x: 320, y: 240 })
  player.tags = ['player']
  player.linearMover = { directionX: 0, directionY: 0, speed: 0 }

  return migrateLegacyProject({
    ...base,
    world: {
      ...DEFAULT_WORLD,
      physicsMode: 'off',
      timeScale: 1,
    },
    entities: { 1: player },
    scenes: {
      scene_main: {
        ...base.scenes.scene_main,
        entityIds: [1],
      },
    },
  })
}

/** Platformer: kinematic controller + Solid ground, physicsMode auto. */
export function createPlatformerProject(projectName = 'Platformer'): ProjectDoc {
  const base = createBlankProject(projectName)
  const scene = base.scenes.scene_main

  const player = createEntityDef(1, 'Player', 'Player', { x: 200, y: 120 })
  player.tags = ['player']
  player.platformerController = {
    maxSpeed: 300,
    jumpForce: 600,
    customGravity: 1500,
    coyoteTime: 0.15,
    jumpBuffer: 0.1,
    groundClass: 'Ground',
    climbClass: '',
    climbSpeed: 120,
  }

  const ground = createEntityDef(2, 'Ground', 'Ground', { x: 320, y: 340 })
  ground.transform.scale = { x: 20, y: 1 }
  ground.solid = { groundClass: 'Ground', surfaceKind: 'solid' }

  return migrateLegacyProject({
    ...base,
    world: { ...DEFAULT_WORLD, physicsMode: 'auto' },
    entities: { 1: player, 2: ground },
    scenes: {
      scene_main: {
        ...scene,
        entityIds: [1, 2],
      },
    },
  })
}
