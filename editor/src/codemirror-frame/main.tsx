import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { artcadeLuaCompletion } from '../codemirror/artcade-lua-completion'
import { luaLanguage } from '../codemirror/lua-lang'
import { themeExtensions } from '../codemirror/artcade-theme'
import {
  type CmFrameThemeId,
  isParentToFrameMessage,
  type ParentToFrameMessage,
} from './protocol'
import './frame.css'

const BASIC_SETUP: ReactCodeMirrorProps['basicSetup'] = {
  lineNumbers:               true,
  highlightActiveLineGutter: true,
  highlightActiveLine:       true,
  foldGutter:                true,
  dropCursor:                true,
  allowMultipleSelections:   false,
  indentOnInput:             true,
  bracketMatching:           true,
  closeBrackets:             true,
  autocompletion:            false,
  syntaxHighlighting:        false,
  rectangularSelection:      false,
  crosshairCursor:           false,
  highlightSelectionMatches: false,
}

function FrameEditor() {
  const [themeId, setThemeId] = useState<CmFrameThemeId>('artcade-dark')
  const [value, setValue] = useState('')
  const [mounted, setMounted] = useState(false)
  const suppressChangeRef = useRef(false)

  const extensions = useMemo(
    () => [
      luaLanguage,
      artcadeLuaCompletion,
      EditorView.lineWrapping,
      ...themeExtensions(themeId),
    ],
    [themeId],
  )

  const postToParent = useCallback((msg: { type: 'ready' } | { type: 'change'; value: string }) => {
    window.parent.postMessage(msg, window.location.origin)
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (!isParentToFrameMessage(event.data)) return

      const msg = event.data as ParentToFrameMessage
      if (msg.type === 'init') {
        setThemeId(msg.theme)
        setValue(msg.value)
        setMounted(true)
      } else if (msg.type === 'set-theme') {
        setThemeId(msg.theme)
      } else if (msg.type === 'update-from-logic') {
        suppressChangeRef.current = true
        setValue(msg.value)
      }
    }

    window.addEventListener('message', onMessage)
    postToParent({ type: 'ready' })

    return () => window.removeEventListener('message', onMessage)
  }, [postToParent])

  if (!mounted) {
    return null
  }

  return (
    <CodeMirror
      value={value}
      height="100%"
      width="100%"
      theme="none"
      extensions={extensions}
      basicSetup={BASIC_SETUP}
      onChange={(v) => {
        setValue(v)
        if (suppressChangeRef.current) {
          suppressChangeRef.current = false
          return
        }
        postToParent({ type: 'change', value: v })
      }}
    />
  )
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found in codemirror-frame')
createRoot(rootEl).render(<FrameEditor />)
