import { describe, expect, it } from 'vitest'
import { promptTextInput } from './native-dialog'
import {
  completeTextPrompt,
  getTextPromptRequest,
  requestTextPrompt,
} from './text-prompt'

describe('text-prompt', () => {
  it('promptTextInput trims non-empty values', async () => {
    const pending = promptTextInput({
      title: 'Rename',
      message: 'Name:',
      defaultValue: ' Main ',
    })
    expect(getTextPromptRequest()?.options.defaultValue).toBe(' Main ')
    completeTextPrompt('  Hero  ')
    await expect(pending).resolves.toBe('Hero')
    expect(getTextPromptRequest()).toBeNull()
  })

  it('resolves null when dismissed', async () => {
    const pending = requestTextPrompt({
      title: 'New',
      message: 'ID:',
    })
    completeTextPrompt(null)
    await expect(pending).resolves.toBeNull()
  })
})
