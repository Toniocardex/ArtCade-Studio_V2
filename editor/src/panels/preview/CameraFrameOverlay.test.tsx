/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CameraFrameOverlay } from './CameraFrameOverlay'

describe('CameraFrameOverlay', () => {
  afterEach(() => cleanup())

  it('matches the initial runtime viewport at world origin', () => {
    render(
      <CameraFrameOverlay
        worldSize={{ x: 1280, y: 640 }}
        viewportSize={{ x: 512, y: 320 }}
        zoom={1}
      />,
    )

    const frame = screen.getByRole('img', { name: 'Camera view 512 by 320' })
    expect(frame.style.left).toBe('0px')
    expect(frame.style.top).toBe('0px')
    expect(frame.style.width).toBe('512px')
    expect(frame.style.height).toBe('320px')
    // Scene-aware letterbox: spread box-shadow dims the off-camera area.
    expect(frame.style.boxShadow).toContain('9999px')
  })

  it('offsets the camera rectangle to the initial camera position', () => {
    render(
      <CameraFrameOverlay
        worldSize={{ x: 1280, y: 640 }}
        viewportSize={{ x: 512, y: 320 }}
        zoom={2}
        cameraStart={{ x: 100, y: 40 }}
      />,
    )

    const frame = screen.getByRole('img', { name: 'Camera view 512 by 320' })
    expect(frame.style.left).toBe('200px')
    expect(frame.style.top).toBe('80px')
    expect(frame.style.width).toBe('1024px')
    expect(frame.style.height).toBe('640px')
  })

  it('renders nothing when the scene is no larger than the viewport', () => {
    const { container } = render(
      <CameraFrameOverlay
        worldSize={{ x: 512, y: 320 }}
        viewportSize={{ x: 512, y: 320 }}
        zoom={1}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
