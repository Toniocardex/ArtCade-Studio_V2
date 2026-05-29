import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project-factory'
import { resolveImageLoadKey, resetResolveImageLoadKeyWarnings } from './resolve-image-load-key'

describe('resolveImageLoadKey', () => {
  it('resolves asset id to path', () => {
    resetResolveImageLoadKeyWarnings()
    const p = {
      ...createBlankProject(),
      assets: {
        a: { id: 'hero_id', name: 'Hero', path: 'assets/images/hero.png' },
      },
    }
    expect(resolveImageLoadKey(p, 'hero_id')).toBe('assets/images/hero.png')
  })

  it('passes through known path', () => {
    const path = 'assets/images/hero.png'
    const p = {
      ...createBlankProject(),
      assets: { a: { id: 'a', name: 'H', path } },
    }
    expect(resolveImageLoadKey(p, path)).toBe(path)
  })
})
