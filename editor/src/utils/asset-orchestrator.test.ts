import { describe, expect, it, vi } from 'vitest'
import { createBlankProject } from './project-factory'
import { createEntityDef } from './project-builders'
import { migrateLegacyProject } from './project-object-types'
import {
  AssetOrchestrator,
  pathsToDescriptors,
  resetAssetFailureLogs,
} from './asset-orchestrator'
import type { AssetOrchestratorDeps } from './asset-orchestrator'

const IMG = 'assets/images/hero.png'

function testProject() {
  return migrateLegacyProject({
    ...createBlankProject(),
    assets: {
      img: { id: 'img', name: 'Hero', path: IMG },
    },
    entities: {
      1: {
        ...createEntityDef(1, 'Hero', 'Hero'),
        sprite: { ...createEntityDef(1, 'Hero', 'Hero').sprite, spriteAssetId: IMG },
      },
    },
    scenes: {
      scene_main: {
        ...createBlankProject().scenes.scene_main,
        entityIds: [1],
      },
      scene_other: {
        id: 'scene_other',
        name: 'Other',
        worldSize: createBlankProject().scenes.scene_main.worldSize,
        viewportSize: createBlankProject().scenes.scene_main.viewportSize,
        backgroundColor: createBlankProject().scenes.scene_main.backgroundColor,
        entityIds: [],
      },
    },
  })
}

function makeOrchestrator(overrides: Partial<AssetOrchestratorDeps> = {}) {
  const logFailure = vi.fn()
  const deps: AssetOrchestratorDeps = {
    readProjectFileBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
    registerImage: vi.fn(() => true),
    registerAudio: vi.fn(() => true),
    isRuntimeReady: () => true,
    scheduleIdle: (fn) => fn(),
    logFailure,
    ...overrides,
  }
  resetAssetFailureLogs()
  return { orch: new AssetOrchestrator(deps), deps, logFailure }
}

describe('asset-orchestrator', () => {
  it('readFile failure records failed and resolves without throw', async () => {
    const { orch, deps } = makeOrchestrator({
      readProjectFileBytes: vi.fn(async () => null),
    })
    const result = await orch.loadScene(testProject(), 'scene_main', '/proj')
    expect(result.ok).toBe(false)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].reason).toBe('read_failed')
    expect(deps.registerImage).not.toHaveBeenCalled()
  })

  it('scene switch mid-load returns cancelled and skips stale register', async () => {
    let resolveRead!: (v: Uint8Array | null) => void
    const readMock = vi.fn(
      () =>
        new Promise<Uint8Array | null>((resolve) => {
          resolveRead = resolve
        }),
    )
    const registerImage = vi.fn(() => true)
    const { orch } = makeOrchestrator({ readProjectFileBytes: readMock, registerImage })

    const p = testProject()
    const first = orch.loadScene(p, 'scene_main', '/proj')
    await orch.loadScene(p, 'scene_other', '/proj')
    resolveRead(new Uint8Array([9]))
    const result = await first
    expect(result.cancelled).toBe(true)
    expect(registerImage).not.toHaveBeenCalled()
  })

  it('deduplicates duplicate paths in one loadScene', async () => {
    const readProjectFileBytes = vi.fn(async () => new Uint8Array([1]))
    const { orch } = makeOrchestrator({ readProjectFileBytes })
    const p = testProject()
    p.entities[2] = {
      ...createEntityDef(2, 'Hero2', 'Hero'),
      sprite: { ...createEntityDef(2, 'Hero2', 'Hero').sprite, spriteAssetId: IMG },
    }
    p.scenes.scene_main.entityIds = [1, 2]
    await orch.loadScene(p, 'scene_main', '/proj')
    expect(readProjectFileBytes).toHaveBeenCalledTimes(1)
  })

  it('dedupes console failure logs per path', async () => {
    const logFailure = vi.fn()
    const { orch } = makeOrchestrator({
      readProjectFileBytes: vi.fn(async () => null),
      logFailure,
    })
    const desc = pathsToDescriptors(testProject(), [IMG])
    orch.loadGeneration = 1
    await orch.loadDescriptors(testProject(), desc, '/p', 1, 'critical')
    await orch.loadDescriptors(testProject(), desc, '/p', 1, 'critical')
    expect(logFailure).toHaveBeenCalledTimes(1)
  })
})
