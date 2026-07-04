/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  shouldOpenSpritesheetStudioOnExplorerEnter,
} from './useAssetExplorerActions'
import { spritesheetStudioTriggerProps } from '../panels/spritesheet-studio/openSpritesheetStudio'

describe('shouldOpenSpritesheetStudioOnExplorerEnter', () => {
  it('requires Enter on a marked trigger with image selection', () => {
    const btn = document.createElement('button')
    Object.entries(spritesheetStudioTriggerProps).forEach(([k, v]) => btn.setAttribute(k, v))
    document.body.append(btn)
    btn.focus()

    expect(
      shouldOpenSpritesheetStudioOnExplorerEnter(
        { key: 'Enter', target: btn },
        { type: 'image', id: 'img1' },
      ),
    ).toBe(true)

    expect(
      shouldOpenSpritesheetStudioOnExplorerEnter(
        { key: 'Enter', target: btn },
        { type: 'audio', id: 'a1' },
      ),
    ).toBe(false)

    const plain = document.createElement('button')
    document.body.append(plain)
    expect(
      shouldOpenSpritesheetStudioOnExplorerEnter(
        { key: 'Enter', target: plain },
        { type: 'image', id: 'img1' },
      ),
    ).toBe(false)

    btn.remove()
    plain.remove()
  })
})
