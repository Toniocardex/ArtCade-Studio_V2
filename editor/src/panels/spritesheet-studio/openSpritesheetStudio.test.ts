/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  isSpritesheetStudioEnterTarget,
  spritesheetStudioTriggerProps,
} from './openSpritesheetStudio'

describe('isSpritesheetStudioEnterTarget', () => {
  it('is true when focus is inside a marked trigger', () => {
    const root = document.createElement('div')
    root.setAttribute('data-panel', 'project-explorer')
    const btn = document.createElement('button')
    Object.entries(spritesheetStudioTriggerProps).forEach(([k, v]) => btn.setAttribute(k, v))
    root.append(btn)
    document.body.append(root)
    btn.focus()
    expect(isSpritesheetStudioEnterTarget(btn)).toBe(true)
    root.remove()
  })

  it('is false for unrelated buttons in the explorer', () => {
    const root = document.createElement('div')
    root.setAttribute('data-panel', 'project-explorer')
    const btn = document.createElement('button')
    root.append(btn)
    document.body.append(root)
    btn.focus()
    expect(isSpritesheetStudioEnterTarget(btn)).toBe(false)
    root.remove()
  })
})
