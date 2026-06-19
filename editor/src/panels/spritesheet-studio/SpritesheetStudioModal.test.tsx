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
    clips: [],
    activeClipIndex: 0,
    setActiveClipIndex: vi.fn(),
    activeClip: null,
    rangeUi: { start: 0, end: 0 },
    setRange: vi.fn(),
    patchActiveClip: vi.fn(),
    addClip: vi.fn(),
    removeActiveClip: vi.fn(),
    grid: { cols: 1, rows: 1, cellW: 16, cellH: 16 },
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
