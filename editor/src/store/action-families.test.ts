import { describe, expect, it } from 'vitest'
import {
  ACTION_FAMILY_BY_TYPE,
  AUTHORING_ACTION_TYPES,
  RUNTIME_ACTION_TYPES,
  VOLATILE_ACTION_TYPES,
  WORKSPACE_ACTION_TYPES,
  getActionFamily,
} from './action-families'

const families = [
  AUTHORING_ACTION_TYPES,
  WORKSPACE_ACTION_TYPES,
  RUNTIME_ACTION_TYPES,
  VOLATILE_ACTION_TYPES,
] as const

describe('action family classification', () => {
  it('assigns each action type to exactly one family', () => {
    const all = families.flat()
    expect(new Set(all).size).toBe(all.length)
    expect(Object.keys(ACTION_FAMILY_BY_TYPE).sort()).toEqual([...all].sort())
  })

  it('keeps saved project edits in authoring', () => {
    expect(getActionFamily('PROJECT_RENAME')).toBe('authoring')
    expect(getActionFamily('ENTITY_SET_SPRITE')).toBe('authoring')
    expect(getActionFamily('ASSET_REMOVE')).toBe('authoring')
    expect(getActionFamily('DIALOG_UPSERT')).toBe('authoring')
  })

  it('keeps UI-only state out of authoring', () => {
    expect(getActionFamily('SELECT_ENTITY')).toBe('workspace')
    expect(getActionFamily('EDITOR_SET_ZOOM')).toBe('workspace')
    expect(getActionFamily('SET_SNAP_TO_GRID')).toBe('workspace')
    expect(getActionFamily('DIALOG_OPEN_MODAL')).toBe('workspace')
  })

  it('separates runtime and high-frequency volatile actions', () => {
    expect(getActionFamily('SET_PLAYING')).toBe('runtime')
    expect(getActionFamily('LOGIC_MARK_PREVIEW_APPLIED')).toBe('runtime')
    expect(getActionFamily('LOG')).toBe('volatile')
    expect(getActionFamily('SET_CURSOR')).toBe('volatile')
  })
})

