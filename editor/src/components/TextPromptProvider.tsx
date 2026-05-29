import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { TextPromptModal } from './TextPromptModal'
import type { PromptTextInputOptions } from '../utils/native-dialog'
import { requestTextPromptTrimmed } from '../utils/text-prompt'

export type TextPromptFn = (options: PromptTextInputOptions) => Promise<string | null>

const TextPromptContext = createContext<TextPromptFn | null>(null)

export function TextPromptProvider({ children }: Readonly<{ children: ReactNode }>) {
  const promptText = useCallback<TextPromptFn>(
    (options) => requestTextPromptTrimmed(options),
    [],
  )

  const value = useMemo(() => promptText, [promptText])

  return (
    <TextPromptContext.Provider value={value}>
      {children}
      <TextPromptModal />
    </TextPromptContext.Provider>
  )
}

export function useTextPrompt(): TextPromptFn {
  const promptText = useContext(TextPromptContext)
  if (!promptText) {
    throw new Error('useTextPrompt must be used within TextPromptProvider')
  }
  return promptText
}
