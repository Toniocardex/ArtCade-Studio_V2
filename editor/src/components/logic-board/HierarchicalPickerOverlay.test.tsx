/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HierarchicalPickerOverlay } from './HierarchicalPickerOverlay'

describe('HierarchicalPickerOverlay', () => {
  it('portals content to document.body and closes on backdrop mousedown', () => {
    const onClose = vi.fn()
    render(
      <HierarchicalPickerOverlay open onClose={onClose}>
        <div data-testid="picker-panel">Panel</div>
      </HierarchicalPickerOverlay>,
    )
    expect(screen.getByTestId('picker-panel')).toBeTruthy()
    expect(document.body.contains(screen.getByTestId('picker-panel'))).toBe(true)

    const backdrop = document.body.querySelector('[role="presentation"]')
    expect(backdrop).toBeTruthy()
    fireEvent.mouseDown(backdrop!)
    expect(onClose).toHaveBeenCalled()
  })
})
