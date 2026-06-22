/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ImageAsset } from '../../types'
import { InspectorClipPreview } from './InspectorClipPreview'

const previewDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQoAAB4MAgKIDaLBAAAAAElFTkSuQmCC'

function spriteAsset(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id: 'sprite_idle',
    name: 'idle.png',
    path: 'assets/images/idle.png',
    usage: 'sprite',
    dataUrl: previewDataUrl,
    clips: [
      {
        name: 'idle',
        fps: 8,
        loop: true,
        frames: [
          { x: 0, y: 0, w: 16, h: 16 },
          { x: 16, y: 0, w: 16, h: 16 },
        ],
      },
    ],
    ...overrides,
  }
}

describe('InspectorClipPreview', () => {
  afterEach(cleanup)

  it('renders the inspector preview without depending on engine texture sync', () => {
    const { container } = render(<InspectorClipPreview asset={spriteAsset()} clipName="idle" />)

    expect(screen.getByTestId('inspector-clip-preview')).toBeTruthy()
    expect(screen.getByText('Clip preview')).toBeTruthy()
    expect(screen.queryByText(/Waiting for engine texture/i)).toBeNull()

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe(previewDataUrl)
    expect(img?.style.transform).toMatch(/^scale\(/)
    expect(img?.style.transformOrigin).toBe('0 0')
  })

  it('toggles the playback control between pause and play', () => {
    render(<InspectorClipPreview asset={spriteAsset()} clipName="idle" />)

    // Starts playing → control offers Pause.
    const pauseBtn = screen.getByRole('button', { name: 'Pause preview' })
    fireEvent.click(pauseBtn)

    // Paused → control now offers Play, and clicking resumes.
    const playBtn = screen.getByRole('button', { name: 'Play preview' })
    fireEvent.click(playBtn)
    expect(screen.getByRole('button', { name: 'Pause preview' })).toBeTruthy()
  })

  it('does not render when the selected clip has no local playback source', () => {
    const asset = spriteAsset({ dataUrl: undefined })

    const { container } = render(<InspectorClipPreview asset={asset} clipName="idle" />)

    expect(container.firstChild).toBeNull()
  })
})
