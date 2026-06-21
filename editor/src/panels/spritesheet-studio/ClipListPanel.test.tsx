/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImageAsset } from '../../types'
import { initialCoreState, type CoreState } from '../../store/editor-store-state'
import { ClipListPanel } from './ClipListPanel'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'

let mockState: CoreState = initialCoreState

vi.mock('../../store/editor-store', () => ({
  useEditorSelector: (selector: (s: CoreState) => unknown) => selector(mockState),
}))

const asset: ImageAsset = {
  id: 'img_walk',
  name: 'walking.png',
  path: 'assets/images/walking.png',
  usage: 'sprite',
}

function session(overrides: Partial<SpritesheetStudioSession>): SpritesheetStudioSession {
  return {
    previewSrc: null,
    cellW: 32,
    cellH: 16,
    effectiveCellW: 32,
    effectiveCellH: 16,
    setCellW: vi.fn(),
    setCellH: vi.fn(),
    slicingMode: 'cell',
    setSlicingMode: vi.fn(),
    gridCols: 2,
    gridRows: 1,
    setGridCols: vi.fn(),
    setGridRows: vi.fn(),
    stripFrameCount: 2,
    setStripFrameCount: vi.fn(),
    stripAxis: 'horizontal',
    setStripAxis: vi.fn(),
    remainder: { remainderW: 0, remainderH: 0 },
    gridWarning: null,
    imgWH: { w: 64, h: 16 },
    grid: { cols: 2, rows: 1, totalFrames: 2 },
    activeClipIndex: -1,
    setActiveClipIndex: vi.fn(),
    activeClip: undefined,
    draftClip: undefined,
    previewClip: undefined,
    clips: [],
    selectedIndices: new Set(),
    rangeUi: null,
    toggleCell: vi.fn(),
    setRange: vi.fn(),
    setSelectionIndices: vi.fn(),
    selectAllFrames: vi.fn(),
    clearSelection: vi.fn(),
    patchActiveClip: vi.fn(),
    patchDraft: vi.fn(),
    startDraftFromSelection: vi.fn(),
    saveDraft: vi.fn(),
    cancelDraft: vi.fn(),
    updateClips: vi.fn(),
    addClip: vi.fn(),
    removeActiveClip: vi.fn(),
    ...overrides,
  }
}

describe('ClipListPanel', () => {
  afterEach(() => {
    cleanup()
    mockState = initialCoreState
  })

  it('shows guided empty state without Add clip', () => {
    render(<ClipListPanel asset={asset} assetId={asset.id} session={session({})} />)

    expect(screen.getByText('No animations yet')).toBeTruthy()
    expect(screen.getByText('Select frames on the sheet to create an animation.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Add clip/i })).toBeNull()
  })

  it('shows draft composer and saves through session callback', () => {
    const saveDraft = vi.fn()
    render(
      <ClipListPanel
        asset={asset}
        assetId={asset.id}
        session={session({
          draftClip: {
            name: 'walking',
            frames: [{ x: 0, y: 0, w: 32, h: 16 }],
            fps: 12,
            loop: true,
          },
          previewClip: {
            name: 'walking',
            frames: [{ x: 0, y: 0, w: 32, h: 16 }],
            fps: 12,
            loop: true,
          },
          saveDraft,
        })}
      />,
    )

    expect(screen.getByText('New animation draft')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Save animation/i }))
    expect(saveDraft).toHaveBeenCalled()
  })

  it('keeps existing clip editing wired to patchActiveClip', () => {
    const patchActiveClip = vi.fn()
    render(
      <ClipListPanel
        asset={asset}
        assetId={asset.id}
        session={session({
          activeClipIndex: 0,
          activeClip: { name: 'walk', frames: [], fps: 8, loop: true },
          previewClip: { name: 'walk', frames: [], fps: 8, loop: true },
          clips: [{ name: 'walk', frames: [], fps: 8, loop: true }],
          patchActiveClip,
        })}
      />,
    )

    fireEvent.change(screen.getByDisplayValue('walk'), { target: { value: 'run' } })
    expect(patchActiveClip).toHaveBeenCalledWith({ name: 'run' }, 'clip-name:0')
  })

  it('routes New animation through the import flow when provided', () => {
    const addClip = vi.fn()
    const onNewAnimation = vi.fn()
    render(
      <ClipListPanel
        asset={asset}
        assetId={asset.id}
        onNewAnimation={onNewAnimation}
        session={session({
          activeClipIndex: 0,
          activeClip: { name: 'walk', frames: [], fps: 8, loop: true },
          previewClip: { name: 'walk', frames: [], fps: 8, loop: true },
          clips: [{ name: 'walk', frames: [], fps: 8, loop: true }],
          addClip,
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /New animation/i }))

    expect(onNewAnimation).toHaveBeenCalledTimes(1)
    expect(addClip).not.toHaveBeenCalled()
  })
})
