import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import { artcadeLuaCompletion } from '../codemirror/artcade-lua-completion'
import { luaLanguage } from '../codemirror/lua-lang'
import { themeExtensions } from '../codemirror/artcade-theme'
import {
  type CmFrameThemeId,
  isParentToFrameMessage,
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

function wheelScrollUnit(event: WheelEvent, view: EditorView): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return 22
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return view.scrollDOM.clientHeight
  return 1
}

const WHEEL_SCROLL_EXTENSION = EditorView.domEventHandlers({
  wheel(event, view) {
    if (event.ctrlKey || event.metaKey) return false
    if (event.deltaX === 0 && event.deltaY === 0) return false

    const unit = wheelScrollUnit(event, view)

    view.scrollDOM.scrollBy({
      left: event.deltaX * unit,
      top:  event.deltaY * unit,
    })
    event.preventDefault()
    return true
  },
})

function FrameEditor() {
  const [themeId, setThemeId] = useState<CmFrameThemeId>('artcade-dark')
  const [value, setValue] = useState('')
  const [mounted, setMounted] = useState(false)
  const suppressChangeRef = useRef(false)

  const extensions = useMemo(
    () => [
      luaLanguage,
      artcadeLuaCompletion,
      WHEEL_SCROLL_EXTENSION,
      EditorView.lineWrapping,
      ...themeExtensions(themeId),
    ],
    [themeId],
  )

  const postToParent = useCallback((msg: { type: 'ready' } | { type: 'change'; value: string } | { type: 'run-preview-shortcut' }) => {
    globalThis.parent.postMessage(msg, globalThis.location.origin)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F5' && event.code !== 'F5') return
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      event.preventDefault()
      event.stopPropagation()
      postToParent({ type: 'run-preview-shortcut' })
    }

    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [postToParent])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== globalThis.location.origin) return
      if (event.source !== window.parent) return
      if (!isParentToFrameMessage(event.data)) return

      const msg = event.data
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

    globalThis.addEventListener('message', onMessage)
    postToParent({ type: 'ready' })

    return () => globalThis.removeEventListener('message', onMessage)
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
