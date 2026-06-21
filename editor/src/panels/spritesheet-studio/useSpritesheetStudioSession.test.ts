/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageAsset } from '../../types'
import { useSpritesheetStudioSession } from './useSpritesheetStudioSession'

vi.mock('../../utils/image-preview-src', () => ({
  isBlobPreviewSrc: () => false,
  measureImageNaturalSize: vi.fn(async () => ({ w: 64, h: 16 })),
  resolveImagePreviewSrc: vi.fn(async () => 'data:image/png;base64,AA=='),
  revokeImagePreviewSrc: vi.fn(),
}))

const baseAsset = (clips: ImageAsset['clips'] = []): ImageAsset => ({
  id: 'img_walk',
  name: 'walking.png',
  path: 'assets/images/walking.png',
  usage: 'sprite',
  dataUrl: 'data:image/png;base64,AA==',
  clips,
})

describe('useSpritesheetStudioSession draft flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a local draft from grid selection without persisting clips', async () => {
    const onPatchClips = vi.fn()
    const { result } = renderHook(() =>
      useSpritesheetStudioSession(baseAsset(), null, onPatchClips),
    )

    await waitFor(() => expect(result.current.grid.totalFrames).toBe(4))

    act(() => result.current.toggleCell(0, 0))

    expect(result.current.draftClip?.name).toBe('walking')
    expect(result.current.draftClip?.frames).toEqual([{ x: 0, y: 0, w: 16, h: 16 }])
    expect(result.current.previewClip).toBe(result.current.draftClip)
    expect(onPatchClips).not.toHaveBeenCalled()
  })

  it('opens new square-frame strips in Frame strip mode', async () => {
    const onPatchClips = vi.fn()
    const { result } = renderHook(() =>
      useSpritesheetStudioSession(baseAsset(), null, onPatchClips),
    )

    await waitFor(() => expect(result.current.slicingMode).toBe('strip'))

    expect(result.current.stripAxis).toBe('horizontal')
    expect(result.current.stripFrameCount).toBe(4)
    expect(result.current.effectiveCellW).toBe(16)
    expect(result.current.effectiveCellH).toBe(16)
  })

  it('persists the draft only when Save animation runs', async () => {
    const onPatchClips = vi.fn()
    const { result } = renderHook(() =>
      useSpritesheetStudioSession(baseAsset(), null, onPatchClips),
    )

    await waitFor(() => expect(result.current.grid.totalFrames).toBe(4))
    act(() => result.current.toggleCell(0, 0))
    act(() => {
      expect(result.current.saveDraft()).toBe(true)
    })

    expect(onPatchClips).toHaveBeenCalledWith([
      { name: 'walking', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 12, loop: true },
    ])
    expect(result.current.draftClip).toBeUndefined()
  })

  it('keeps saved clip selection auto-saving as before', async () => {
    const onPatchClips = vi.fn()
    const clip = { name: 'walk', frames: [], fps: 8, loop: true }
    const { result } = renderHook(() =>
      useSpritesheetStudioSession(baseAsset([clip]), null, onPatchClips),
    )

    await waitFor(() => expect(result.current.grid.totalFrames).toBe(2))
    act(() => result.current.toggleCell(1, 0))

    expect(result.current.draftClip).toBeUndefined()
    expect(onPatchClips).toHaveBeenCalledWith([
      { name: 'walk', frames: [{ x: 32, y: 0, w: 32, h: 16 }], fps: 8, loop: true },
    ], undefined)
  })
})
