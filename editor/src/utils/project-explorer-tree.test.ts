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
      img1: { id: 'img1', name: 'hero.png', path: 'assets/images/hero.png' },
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

  it('lists entities only for active scene', () => {
    const project = minimalProject()
    const data = buildProjectExplorerData(project, 'level2', '')
    expect(data.entities).toHaveLength(0)
    const mainData = buildProjectExplorerData(project, 'main', '')
    expect(mainData.entities).toHaveLength(1)
    expect(mainData.entities[0]?.name).toBe('Player')
  })

  it('counts asset folder items', () => {
    const data = buildProjectExplorerData(minimalProject(), 'main', '')
    const images = data.assetFolders.find((f) => f.id === 'images')
    expect(images?.count).toBe(1)
    const audio = data.assetFolders.find((f) => f.id === 'audio')
    expect(audio?.count).toBe(1)
    const scripts = data.assetFolders.find((f) => f.id === 'scripts')
    expect(scripts?.scripts.length).toBeGreaterThanOrEqual(2)
  })

  it('filters by search across sections', () => {
    const data = buildProjectExplorerData(minimalProject(), 'main', 'hero')
    expect(data.scenes).toHaveLength(0)
    expect(data.entities).toHaveLength(0)
    const images = data.assetFolders.find((f) => f.id === 'images')
    expect(images?.images).toHaveLength(1)
    expect(images?.images[0]?.name).toBe('hero.png')
  })

  it('includes entity types from objectTypes', () => {
    const data = buildProjectExplorerData(minimalProject(), 'main', '')
    expect(data.entityTypes.some((t) => t.objectTypeId === 'enemy')).toBe(true)
  })
})

describe('assetFolderItemCount', () => {
  it('sums children across kinds', () => {
    const folder = {
      id: 'images' as const,
      label: 'Images',
      count: 2,
      images: [{ id: 'a', name: 'a', path: 'p' }, { id: 'b', name: 'b', path: 'p2' }],
      audio: [],
      fonts: [],
      scripts: [],
      tilesets: [],
    }
    expect(assetFolderItemCount(folder)).toBe(2)
  })
})
