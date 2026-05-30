/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EditorTab } from './EditorTab'
import { EditorButton } from './EditorButton'
import { SectionCollapse } from './SectionCollapse'

describe('editor ui primitives', () => {
  it('EditorTab exposes tab role and selection', () => {
    render(<EditorTab active>Canvas</EditorTab>)
    const tab = screen.getByRole('tab', { name: 'Canvas' })
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('EditorButton renders as button', () => {
    render(<EditorButton>Save</EditorButton>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('SectionCollapse toggles expanded state', () => {
    render(
      <SectionCollapse title="Metadata" defaultOpen={false}>
        <p>Entity ID 42</p>
      </SectionCollapse>,
    )
    const toggle = screen.getByRole('button', { name: 'Metadata' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Entity ID 42')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Entity ID 42')).toBeTruthy()
  })
})
