/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { TextPromptProvider, useTextPrompt, type TextPromptFn } from './TextPromptProvider'
import {
  TEXT_PROMPT_TEST_IDS,
  resetTextPromptForTests,
} from '../utils/text-prompt'

function PromptHost({ promptRef }: Readonly<{ promptRef: { current: TextPromptFn | null } }>) {
  promptRef.current = useTextPrompt()
  return null
}

describe('TextPromptModal', () => {
  afterEach(() => {
    resetTextPromptForTests()
    cleanup()
  })

  it('renders themed modal with test ids and submits trimmed value', async () => {
    const promptRef: { current: TextPromptFn | null } = { current: null }
    render(
      <TextPromptProvider>
        <PromptHost promptRef={promptRef} />
      </TextPromptProvider>,
    )

    let pending!: Promise<string | null>
    await act(async () => {
      pending = promptRef.current!({
        title: 'Rename scene',
        message: 'Scene name:',
        defaultValue: 'Main Scene',
      })
    })

    const input = await screen.findByTestId(TEXT_PROMPT_TEST_IDS.input) as HTMLInputElement
    expect(input.value).toBe('Main Scene')

    fireEvent.change(input, { target: { value: '  Arena  ' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId(TEXT_PROMPT_TEST_IDS.submit))
    })

    await expect(pending).resolves.toBe('Arena')
    expect(screen.queryByTestId(TEXT_PROMPT_TEST_IDS.modal)).toBeNull()
  })

  it('cancel closes without a value', async () => {
    const promptRef: { current: TextPromptFn | null } = { current: null }
    render(
      <TextPromptProvider>
        <PromptHost promptRef={promptRef} />
      </TextPromptProvider>,
    )

    let pending!: Promise<string | null>
    await act(async () => {
      pending = promptRef.current!({ title: 'New', message: 'ID:' })
    })

    await screen.findByTestId(TEXT_PROMPT_TEST_IDS.modal)
    await act(async () => {
      fireEvent.click(screen.getByTestId(TEXT_PROMPT_TEST_IDS.cancel))
    })
    await expect(pending).resolves.toBeNull()
    expect(screen.queryByTestId(TEXT_PROMPT_TEST_IDS.modal)).toBeNull()
  })
})
