import { EngineScriptEditor } from './EngineScriptEditor'

export interface CodeEditorProps {
  value:    string
  language: string
  theme:    string
  onChange: (value: string) => void
  onReady?: () => void
}

/** Thin alias — prefer `EngineScriptEditor`. */
export default function CodeEditor({
  value, theme, onChange,
}: CodeEditorProps) {
  return (
    <EngineScriptEditor
      sourceCode={value}
      theme={theme}
      onChange={onChange}
    />
  )
}
