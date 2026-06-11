import { describe, expect, it } from 'vitest'
import {
  instanceBaseName,
  isInstanceNameTaken,
  nextInstanceName,
} from './project-instance-names'
import type { ProjectDoc, Transform } from '../types'

const xf: Transform = { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } }

function project(entityNames: string[], instanceNames: (string | undefined)[] = []): ProjectDoc {
  const entities = Object.fromEntries(
    entityNames.map((name, i) => [
      i + 1,
      { id: i + 1, name, className: 'Coin', tags: [], transform: xf, sprite: {} },
    ]),
  )
  return {
    projectName: 'Test',
    version: '1',
    targetFPS: 60,
    activeSceneId: 'main',
    mainScriptPath: 'scripts/main.lua',
    entities,
    scenes: {
      main: {
        id: 'main',
        name: 'Main',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        entityIds: entityNames.map((_, i) => i + 1),
        instances: instanceNames.map((instanceName, i) => ({
          id: i + 1,
          objectTypeId: 'Coin',
          ...(instanceName ? { instanceName } : {}),
          transform: xf,
        })),
      },
    },
  }
}

describe('instanceBaseName', () => {
  it('strips a trailing numeric suffix only', () => {
    expect(instanceBaseName('Coin_2')).toBe('Coin')
    expect(instanceBaseName('Coin')).toBe('Coin')
    expect(instanceBaseName('Coin_2_5')).toBe('Coin_2')
    expect(instanceBaseName('Coin_v2')).toBe('Coin_v2')
  })
})

describe('nextInstanceName', () => {
  it('starts at _1 when only the base name exists', () => {
    expect(nextInstanceName(project(['Coin']), 'Coin')).toBe('Coin_1')
  })

  it('continues after the highest suffix across entities and instances', () => {
    const p = project(['Coin', 'Coin_1'], [undefined, 'Coin_7'])
    expect(nextInstanceName(p, 'Coin')).toBe('Coin_8')
    expect(nextInstanceName(p, 'Coin_1')).toBe('Coin_8')
  })

  it('treats regex metacharacters in names literally', () => {
    expect(nextInstanceName(project(['C(o)in_2']), 'C(o)in_2')).toBe('C(o)in_3')
  })
})

describe('isInstanceNameTaken', () => {
  it('matches entity names and instance names verbatim', () => {
    const p = project(['Coin'], ['CoinAlias'])
    expect(isInstanceNameTaken(p, 'Coin')).toBe(true)
    expect(isInstanceNameTaken(p, 'CoinAlias')).toBe(true)
    expect(isInstanceNameTaken(p, 'Gem')).toBe(false)
  })
})
