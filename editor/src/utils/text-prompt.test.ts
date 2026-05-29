import { describe, expect, it } from 'vitest'
import { promptTextInput } from './native-dialog'
import {
  completeTextPrompt,
  getTextPromptRequest,
  requestTextPrompt,
  requestTextPromptTrimmed,
  resetTextPromptForTests,
  TextPromptBusyError,
  trimPromptResult,
} from './text-prompt'

describe('text-prompt', () => {
  it('trimPromptResult normalizes whitespace', () => {
    expect(trimPromptResult('  Hero  ')).toBe('Hero')
    expect(trimPromptResult('   ')).toBeNull()
    expect(trimPromptResult(null)).toBeNull()
  })

  it('requestTextPromptTrimmed trims non-empty values', async () => {
    const pending = requestTextPromptTrimmed({
      title: 'Rename',
      message: 'Name:',
      defaultValue: ' Main ',
    })
    expect(getTextPromptRequest()?.options.defaultValue).toBe(' Main ')
    completeTextPrompt('  Hero  ')
    await expect(pending).resolves.toBe('Hero')
    expect(getTextPromptRequest()).toBeNull()
  })

  it('promptTextInput delegates to trimmed queue', async () => {
    const pending = promptTextInput({
      title: 'Rename',
      message: 'Name:',
    })
    completeTextPrompt('Player')
    await expect(pending).resolves.toBe('Player')
  })

  it('resolves null when dismissed', async () => {
    const pending = requestTextPrompt({
      title: 'New',
      message: 'ID:',
    })
    completeTextPrompt(null)
    await expect(pending).resolves.toBeNull()
  })

  it('rejects when a prompt is already open', async () => {
    resetTextPromptForTests()
    void requestTextPrompt({ title: 'A', message: 'x' })
    await expect(requestTextPrompt({ title: 'B', message: 'y' })).rejects.toBeInstanceOf(
      TextPromptBusyError,
    )
    completeTextPrompt(null)
  })
})
