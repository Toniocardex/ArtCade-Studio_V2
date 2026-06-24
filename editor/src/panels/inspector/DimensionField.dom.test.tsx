/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DimensionField } from './DimensionField'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DimensionField', () => {
  it('commits only the edited axis when unlocked', () => {
    const onCommit = vi.fn()
    render(
      <DimensionField
        width={512}
        height={320}
        locked={false}
        onToggleLock={() => {}}
        onCommit={onCommit}
      />,
    )

    const width = screen.getByLabelText('Width') as HTMLInputElement
    fireEvent.change(width, { target: { value: '640' } })
    fireEvent.blur(width)

    expect(onCommit).toHaveBeenCalledWith({ width: 640, height: 320 })
  })

  it('scales the other axis to preserve ratio when locked', () => {
    const onCommit = vi.fn()
    render(
      <DimensionField
        width={400}
        height={200}
        locked
        onToggleLock={() => {}}
        onCommit={onCommit}
      />,
    )

    // ratio 2:1 — doubling width to 800 should scale height to 400.
    const width = screen.getByLabelText('Width') as HTMLInputElement
    fireEvent.change(width, { target: { value: '800' } })
    fireEvent.blur(width)

    expect(onCommit).toHaveBeenCalledWith({ width: 800, height: 400 })
  })

  it('clamps out-of-range values to the scene dimension bounds', () => {
    const onCommit = vi.fn()
    render(
      <DimensionField
        width={512}
        height={320}
        locked={false}
        onToggleLock={() => {}}
        onCommit={onCommit}
      />,
    )

    const height = screen.getByLabelText('Height') as HTMLInputElement
    fireEvent.change(height, { target: { value: '5' } })
    fireEvent.blur(height)

    // parseSceneDimension floor is 64.
    expect(onCommit).toHaveBeenCalledWith({ width: 512, height: 64 })
  })

  it('fires the lock toggle callback', () => {
    const onToggleLock = vi.fn()
    render(
      <DimensionField
        width={512}
        height={320}
        locked={false}
        onToggleLock={onToggleLock}
        onCommit={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Lock aspect ratio' }))
    expect(onToggleLock).toHaveBeenCalled()
  })
})
