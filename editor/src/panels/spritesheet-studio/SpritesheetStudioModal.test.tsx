/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SpritesheetStudioModal } from './SpritesheetStudioModal'
import { initialCoreState, type CoreState } from '../../store/editor-store-state'

let mockState: CoreState = initialCoreState

vi.mock('../../store/editor-store', () => ({
  useEditor: () => ({ state: mockState, dispatch: vi.fn() }),
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
})
