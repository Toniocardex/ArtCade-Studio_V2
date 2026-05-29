import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isBlobPreviewSrc, resolveImagePreviewSrc } from './image-preview-src'

vi.mock('./asset-file-api', () => ({
  readProjectFileBytes: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
  bytesToArrayBuffer: (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
}))

vi.mock('./project', () => ({
  dirName: (p: string) => p.replace(/[/\\][^/\\]+$/, ''),
}))

describe('image-preview-src', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns dataUrl when present', async () => {
    const url = await resolveImagePreviewSrc(
      { path: 'a.png', dataUrl: 'data:image/png;base64,AA==' },
      '/proj/game.artcade',
    )
    expect(url).toBe('data:image/png;base64,AA==')
  })

  it('loads blob URL from project file when dataUrl missing', async () => {
    const url = await resolveImagePreviewSrc(
      { path: 'assets/images/walk.png' },
      'C:/proj/game.artcade',
    )
    expect(url).not.toBeNull()
    expect(isBlobPreviewSrc(url)).toBe(true)
    if (url) URL.revokeObjectURL(url)
  })
})
