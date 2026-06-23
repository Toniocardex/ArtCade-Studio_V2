import { describe, expect, it } from 'vitest'
import { isArtcadePackagePath, isEncryptedArtcadeContainer } from './artcade-package'

describe('isArtcadePackagePath', () => {
  it('matches .artcade regardless of case', () => {
    expect(isArtcadePackagePath('game.artcade')).toBe(true)
    expect(isArtcadePackagePath('GAME.ARTCADE')).toBe(true)
    expect(isArtcadePackagePath('project.json')).toBe(false)
  })
})

describe('isEncryptedArtcadeContainer', () => {
  it('detects the ARTCADE1 magic prefix', () => {
    const bytes = new TextEncoder().encode('ARTCADE1\x01\x00rest-of-container')
    expect(isEncryptedArtcadeContainer(bytes)).toBe(true)
  })

  it('returns false for a plain ZIP (PK header)', () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0])
    expect(isEncryptedArtcadeContainer(bytes)).toBe(false)
  })

  it('returns false for bytes shorter than the magic', () => {
    expect(isEncryptedArtcadeContainer(new Uint8Array([0x41, 0x52]))).toBe(false)
  })
})
