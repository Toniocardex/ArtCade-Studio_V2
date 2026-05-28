// ---------------------------------------------------------------------------
// EngineScriptEditor — CodeMirror 6 inside an isolated iframe (no app CSS).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  type CmFrameThemeId,
  isFrameToParentMessage,
} from '../codemirror-frame/protocol'
import { RUN_PREVIEW_SHORTCUT_EVENT } from '../hooks/usePreviewPlayShortcut'

export type EngineScriptEditorProps = Readonly<{
  sourceCode: string
  theme: string
  onChange: (value: string) => void
}>

function toFrameTheme(theme: string): CmFrameThemeId {
  return theme === 'artcade-light' ? 'artcade-light' : 'artcade-dark'
}

export function EngineScriptEditor({
  sourceCode,
  theme,
  onChange,
}: EngineScriptEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef = useRef(false)
  /** Last text the iframe reported (or we pushed); avoids echo loops with update-from-logic. */
  const lastSyncedRef = useRef(sourceCode)

  const frameSrc = useMemo(
    () => new URL('codemirror-frame.html', globalThis.location.href).href,
    [],
  )

  const postToFrame = useCallback((data: unknown) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(data, globalThis.location.origin)
  }, [])

  const sendInit = useCallback(() => {
    lastSyncedRef.current = sourceCode
    postToFrame({
      type: 'init',
      value: sourceCode,
      theme: toFrameTheme(theme),
    })
  }, [postToFrame, theme, sourceCode])

  useEffect(() => {
    readyRef.current = false
  }, [frameSrc])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== globalThis.location.origin) return
      if (event.source !== iframeRef.current?.contentWindow) return
      if (!isFrameToParentMessage(event.data)) return

      if (event.data.type === 'ready') {
        readyRef.current = true
        sendInit()
        return
      }

      if (event.data.type === 'change') {
        lastSyncedRef.current = event.data.value
        onChange(event.data.value)
        return
      }

      if (event.data.type === 'run-preview-shortcut') {
        globalThis.dispatchEvent(new CustomEvent(RUN_PREVIEW_SHORTCUT_EVENT))
      }
    }

    globalThis.addEventListener('message', onMessage)
    return () => globalThis.removeEventListener('message', onMessage)
  }, [onChange, sendInit])

  useEffect(() => {
    if (!readyRef.current) return
    postToFrame({ type: 'set-theme', theme: toFrameTheme(theme) })
  }, [theme, postToFrame])

  // External store update (Logic Board, reload, etc.) — push into iframe without remount.
  useEffect(() => {
    if (!readyRef.current) return
    if (sourceCode === lastSyncedRef.current) return

    lastSyncedRef.current = sourceCode
    postToFrame({ type: 'update-from-logic', value: sourceCode })
  }, [sourceCode, postToFrame])

  return (
    <iframe
      ref={iframeRef}
      src={frameSrc}
      title="Lua script editor"
      className="block w-full h-full min-h-0 overflow-auto border-0 bg-[var(--bg)]"
      sandbox="allow-scripts allow-same-origin"
    />
  )
}
