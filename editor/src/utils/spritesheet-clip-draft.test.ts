import { describe, expect, it } from 'vitest'
import type { ImageAsset } from '../types'
import {
  nextClipDraftName,
  normalizeClipDraftName,
  validateClipDraft,
} from './spritesheet-clip-draft'

const asset: ImageAsset = {
  id: 'img_walk',
  name: 'Walking Knight.png',
  path: 'assets/images/Walking Knight.png',
  usage: 'sprite',
}

describe('spritesheet-clip-draft', () => {
  it('derives a normalized draft name from the asset filename', () => {
    expect(normalizeClipDraftName('Walking Knight.png')).toBe('walking_knight')
  })

  it('adds a suffix when the draft name is already used on the sheet', () => {
    expect(nextClipDraftName(asset, [
      { name: 'walking_knight', frames: [], fps: 12, loop: true },
    ])).toBe('walking_knight_2')
  })

  it('validates required frames, name, and duplicates', () => {
    const draft = {
      name: 'walk',
      frames: [{ x: 0, y: 0, w: 16, h: 16 }],
      fps: 12,
      loop: true,
    }
    expect(validateClipDraft(undefined, [], null).canSave).toBe(false)
    expect(validateClipDraft({ ...draft, frames: [] }, [], null).message).toContain('frame')
    expect(validateClipDraft({ ...draft, name: ' ' }, [], null).message).toContain('Name')
    expect(validateClipDraft(draft, [draft], null).message).toContain('already exists')
    expect(validateClipDraft(draft, [], 'enemy.png').message).toContain('enemy.png')
    expect(validateClipDraft(draft, [], null)).toEqual({ canSave: true, message: null })
  })
})
