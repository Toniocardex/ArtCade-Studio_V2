/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SpritesheetStudioModal } from './SpritesheetStudioModal'
import { initialCoreState, type CoreState } from '../../store/editor-store-state'

let mockState: CoreState = initialCoreState

vi.mock('../../store/editor-store', () => ({
  useEditorDispatch: () => vi.fn(),
  useEditorSelector: (selector: (s: CoreState) => unknown) => selector(mockState),
}))

vi.mock('./useSpritesheetWasmSync', () => ({ useSpritesheetWasmSync: vi.fn() }))
vi.mock('./useSpritesheetStudioSession', () => ({
  useSpritesheetStudioSession: () => ({
    previewSrc: null,
    cellW: 16,
    cellH: 16,
    effectiveCellW: 16,
    effectiveCellH: 16,
    setCellW: vi.fn(),
    setCellH: vi.fn(),
    slicingMode: 'cell',
    setSlicingMode: vi.fn(),
    gridCols: 1,
    gridRows: 1,
    setGridCols: vi.fn(),
    setGridRows: vi.fn(),
    stripFrameCount: 1,
    setStripFrameCount: vi.fn(),
    stripAxis: 'horizontal',
    setStripAxis: vi.fn(),
    remainder: { remainderW: 0, remainderH: 0 },
    gridWarning: null,
    imgWH: { w: 16, h: 16 },
    clips: [],
    activeClipIndex: 0,
    setActiveClipIndex: vi.fn(),
    activeClip: undefined,
    draftClip: undefined,
    previewClip: undefined,
    selectedIndices: new Set(),
    rangeUi: { start: 0, end: 0 },
    toggleCell: vi.fn(),
    setSelectionIndices: vi.fn(),
    selectAllFrames: vi.fn(),
    clearSelection: vi.fn(),
    setRange: vi.fn(),
    patchActiveClip: vi.fn(),
    patchDraft: vi.fn(),
    startDraftFromSelection: vi.fn(),
    saveDraft: vi.fn(),
    cancelDraft: vi.fn(),
    updateClips: vi.fn(),
    addClip: vi.fn(),
    removeActiveClip: vi.fn(),
    grid: { cols: 1, rows: 1, totalFrames: 1 },
  }),
}))

describe('SpritesheetStudioModal', () => {
  afterEach(() => {
    cleanup()
    mockState = initialCoreState
  })

  it('renders nothing when spritesheetStudio is closed', () => {
    const { container } = render(<SpritesheetStudioModal />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[data-testid="spritesheet-preview-host"]')).toBeNull()
  })

  it('renders nothing when open but asset is missing', () => {
    mockState = {
      ...initialCoreState,
      spritesheetStudio: { open: true, imageAssetId: 'missing' },
      project: {
        projectName: 'T',
        version: '2.0.0',
        targetFPS: 60,
        activeSceneId: 's',
        mainScriptPath: 'scripts/main.lua',
        entities: {},
        scenes: {},
        assets: {},
      },
    }
    const { container } = render(<SpritesheetStudioModal />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[data-testid="spritesheet-preview-host"]')).toBeNull()
  })

  it('opens dialog when studio is open with a valid image asset', () => {
    mockState = {
      ...initialCoreState,
      spritesheetStudio: { open: true, imageAssetId: 'img1' },
      project: {
        projectName: 'T',
        version: '2.0.0',
        targetFPS: 60,
        activeSceneId: 's',
        mainScriptPath: 'scripts/main.lua',
        entities: {},
        scenes: {},
        assets: {
          img1: {
            id: 'img1',
            name: 'hero.png',
            path: 'assets/images/hero.png',
            usage: 'sprite',
            dataUrl: 'data:image/png;base64,AA==',
          },
        },
      },
    }
    render(<SpritesheetStudioModal />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/Sprite Studio — hero.png/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Reset position/i })).toBeTruthy()
  })
})
