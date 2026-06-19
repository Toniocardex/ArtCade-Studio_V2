import { describe, expect, it } from 'vitest'
import {
  assetFolderItemCount,
  buildProjectExplorerData,
  matchesExplorerQuery,
  normalizeExplorerQuery,
} from './project-explorer-tree'
import type { ProjectDoc } from '../types'

function minimalProject(): ProjectDoc {
  return {
    projectName: 'Test',
    version: '1',
    targetFPS: 60,
    activeSceneId: 'main',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1,
        name: 'Player',
        className: 'Player',
        transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } },
        sprite: {},
        scriptPath: 'scripts/player.lua',
      },
    },
    scenes: {
      main: {
        id: 'main',
        name: 'Main Scene',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        entityIds: [1],
      },
      level2: {
        id: 'level2',
        name: 'Level Two',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        entityIds: [],
      },
    },
    assets: {
      img1: { id: 'img1', name: 'hero.png', path: 'assets/images/hero.png', usage: 'sprite' },
    },
    audioAssets: {
      snd1: { id: 'snd1', name: 'jump.ogg', path: 'assets/audio/jump.ogg' },
    },
    objectTypes: {
      enemy: {
        id: 'enemy',
        displayName: 'Enemy',
        tags: [],
        sprite: {},
      },
    },
  }
}

describe('normalizeExplorerQuery', () => {
  it('trims and lowercases', () => {
    expect(normalizeExplorerQuery('  Hero ')).toBe('hero')
  })
})

describe('matchesExplorerQuery', () => {
  it('matches empty query against anything', () => {
    expect(matchesExplorerQuery('', 'anything')).toBe(true)
  })

  it('matches substring case-insensitively', () => {
    expect(matchesExplorerQuery('play', 'TestPlayer')).toBe(true)
    expect(matchesExplorerQuery('zzz', 'TestPlayer')).toBe(false)
  })
})

describe('buildProjectExplorerData', () => {
  it('lists scenes with start scene flag', () => {
    const data = buildProjectExplorerData(minimalProject(), 'main', '')
    expect(data.scenes).toHaveLength(2)
    const main = data.scenes.find((s) => s.sceneId === 'main')
    expect(main?.isStartScene).toBe(true)
    const level2 = data.scenes.find((s) => s.sceneId === 'level2')
    expect(level2?.isStartScene).toBe(false)
  })

  it('lists entity groups only for active scene', () => {
    const project = minimalProject()
    const data = buildProjectExplorerData(project, 'level2', '')
    expect(data.entityGroups).toHaveLength(0)
    const mainData = buildProjectExplorerData(project, 'main', '')
    expect(mainData.entityGroups).toHaveLength(1)
    expect(mainData.entityGroups[0]?.displayName).toBe('Player')
    expect(mainData.entityGroups[0]?.instances[0]?.name).toBe('Player')
  })

  it('groups instances of the same object type under one row', () => {
    const project = minimalProject()
    project.entities[2] = {
      ...project.entities[1],
      id: 2,
      name: 'Coin_1',
      className: 'Coin',
    }
    project.entities[3] = {
      ...project.entities[1],
      id: 3,
      name: 'Coin_2',
      className: 'Coin',
    }
    project.scenes.main.entityIds = [1, 2, 3]
    project.scenes.main.instances = [
      { id: 2, objectTypeId: 'coin', transform: project.entities[2].transform },
      { id: 3, objectTypeId: 'coin', transform: project.entities[3].transform },
    ]
    project.objectTypes = {
      ...project.objectTypes,
      coin: { id: 'coin', displayName: 'Coin', tags: [], sprite: {} },
    }

    const data = buildProjectExplorerData(project, 'main', '')
    expect(data.entityGroups).toHaveLength(2)
    const coinGroup = data.entityGroups.find((g) => g.typeKey === 'coin')
    expect(coinGroup?.objectTypeId).toBe('coin')
    expect(coinGroup?.displayName).toBe('Coin')
    expect(coinGroup?.instances.map((i) => i.name)).toEqual(['Coin_1', 'Coin_2'])
    // Legacy entity without an instance falls back to a class group.
    const playerGroup = data.entityGroups.find((g) => g.typeKey === 'class:Player')
    expect(playerGroup?.objectTypeId).toBeNull()
    expect(playerGroup?.instances).toHaveLength(1)
  })

  it('search keeps the whole group on type-name match and filters instances otherwise', () => {
    const project = minimalProject()
    project.entities[2] = {
      ...project.entities[1],
      id: 2,
      name: 'Coin_1',
      className: 'Coin',
    }
    project.entities[3] = {
      ...project.entities[1],
      id: 3,
      name: 'Coin_2',
      className: 'Coin',
    }
    project.scenes.main.entityIds = [1, 2, 3]
    project.scenes.main.instances = [
      { id: 2, objectTypeId: 'coin', transform: project.entities[2].transform },
      { id: 3, objectTypeId: 'coin', transform: project.entities[3].transform },
    ]
    project.objectTypes = {
      ...project.objectTypes,
      coin: { id: 'coin', displayName: 'Coin', tags: [], sprite: {} },
    }

    const byType = buildProjectExplorerData(project, 'main', 'coin')
    expect(byType.entityGroups).toHaveLength(1)
    expect(byType.entityGroups[0]?.instances).toHaveLength(2)

    const byInstance = buildProjectExplorerData(project, 'main', 'Coin_2')
    expect(byInstance.entityGroups).toHaveLength(1)
    expect(byInstance.entityGroups[0]?.instances.map((i) => i.name)).toEqual(['Coin_2'])
  })

  it('counts asset folder items', () => {
    const data = buildProjectExplorerData(minimalProject(), 'main', '')
    const images = data.assetFolders.find((f) => f.id === 'images')
    expect(images?.count).toBe(1)
    expect(images?.imageUsageGroups.find((g) => g.usage === 'sprite')?.images).toHaveLength(1)
    expect(images?.imageUsageGroups.find((g) => g.usage === 'background')?.images).toHaveLength(0)
    const audio = data.assetFolders.find((f) => f.id === 'audio')
    expect(audio?.count).toBe(1)
    const scripts = data.assetFolders.find((f) => f.id === 'scripts')
    expect(scripts?.scripts.length).toBeGreaterThanOrEqual(2)
  })

  it('filters by search across sections', () => {
    const data = buildProjectExplorerData(minimalProject(), 'main', 'hero')
    expect(data.scenes).toHaveLength(0)
    expect(data.entityGroups).toHaveLength(0)
    const images = data.assetFolders.find((f) => f.id === 'images')
    expect(images?.images).toHaveLength(1)
    expect(images?.images[0]?.name).toBe('hero.png')
  })

})

describe('assetFolderItemCount', () => {
  it('sums children across kinds', () => {
    const folder = {
      id: 'images' as const,
      label: 'Images',
      count: 2,
      imageUsageGroups: [],
      images: [
        { id: 'a', name: 'a', path: 'p', usage: 'sprite' as const },
        { id: 'b', name: 'b', path: 'p2', usage: 'background' as const },
      ],
      audio: [],
      fonts: [],
      scripts: [],
      tilesets: [],
    }
    expect(assetFolderItemCount(folder)).toBe(2)
  })
})
