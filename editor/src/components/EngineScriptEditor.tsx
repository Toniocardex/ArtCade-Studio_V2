// ---------------------------------------------------------------------------

// EngineScriptEditor — CodeMirror 6 inside an isolated iframe (no app CSS).

// ---------------------------------------------------------------------------



import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useCodeParser } from '../hooks/useCodeParser'

import {

  type CmFrameThemeId,

  isFrameToParentMessage,

} from '../codemirror-frame/protocol'



export interface EngineScriptEditorProps {

  sourceCode: string

  theme:      string

  onChange:   (value: string) => void

  onParseCode?: (code: string) => void

}



function toFrameTheme(theme: string): CmFrameThemeId {

  return theme === 'artcade-light' ? 'artcade-light' : 'artcade-dark'

}



export function EngineScriptEditor({

  sourceCode,

  theme,

  onChange,

  onParseCode,

}: EngineScriptEditorProps) {

  const iframeRef = useRef<HTMLIFrameElement>(null)

  const readyRef = useRef(false)

  /** Last text the iframe reported (or we pushed); avoids echo loops with update-from-logic. */

  const lastSyncedRef = useRef(sourceCode)

  const parseCode = useCodeParser(onParseCode)



  const frameSrc = useMemo(() => {

    return new URL('codemirror-frame.html', window.location.href).href

  }, [])



  const postToFrame = useCallback((data: unknown) => {

    const win = iframeRef.current?.contentWindow

    if (!win) return

    win.postMessage(data, window.location.origin)

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

      if (event.origin !== window.location.origin) return

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

        parseCode(event.data.value)

      }

    }



    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)

  }, [onChange, parseCode, sendInit])



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

      className="block w-full h-full min-h-0 border-0 bg-[var(--bg)]"

      sandbox="allow-scripts allow-same-origin"

    />

  )

}


