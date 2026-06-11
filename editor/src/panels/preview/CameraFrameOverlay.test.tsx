/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CameraFrameOverlay } from './CameraFrameOverlay'

describe('CameraFrameOverlay', () => {
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
  })
})
