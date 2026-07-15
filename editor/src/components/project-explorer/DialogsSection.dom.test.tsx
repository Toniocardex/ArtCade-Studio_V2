/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DialogsSection } from './DialogsSection'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DialogsSection', () => {
  it('opens the library and a dialog leaf', () => {
    const onOpenLibrary = vi.fn()
    const onOpenDialog = vi.fn()
    render(
      <DialogsSection
        dialogs={{ intro: {} }}
        open
        onToggle={() => {}}
        onOpenLibrary={onOpenLibrary}
        onOpenDialog={onOpenDialog}
      />,
    )

    fireEvent.click(screen.getByLabelText('Open Dialog library'))
    fireEvent.click(screen.getByText('intro'))

    expect(onOpenLibrary).toHaveBeenCalledTimes(1)
    expect(onOpenDialog).toHaveBeenCalledWith('intro')
  })
})
