// ---------------------------------------------------------------------------
// CodeEditor — native, zero-flicker Monaco wrapper.
//
// Implements the two prescribed patterns:
//
//  • UNCONTROLLED (anti scroll-jump): the initial text is captured once via a
//    ref and passed as `defaultValue`. We NEVER feed `value` back, so a store
//    update from onChange can't make @monaco-editor/react re-set the model
//    (which reset scroll/cursor → the "text flashes on line 1 then jumps").
//
//  • MEASURE-FIRST (anti flicker/collapse): the Editor is NOT mounted until a
//    ResizeObserver (wired in useLayoutEffect) reports real geometry. Monaco
//    then receives explicit width/height, `automaticLayout:false`, and an
//    explicit `lineHeight` so the browser can't trigger a destructive second
//    layout from late font metrics. The same observer intrinsically fixes the
//    display:none→visible tab-switch case (0x0 → real triggers editor.layout
//    before the user can interact).
// ---------------------------------------------------------------------------

import Editor from '@monaco-editor/react'
import type { Monaco, OnMount } from '@monaco-editor/react'
import { useLayoutEffect, useRef, useState } from 'react'

type CodeEditorInstance = Parameters<OnMount>[0]

export interface CodeEditorProps {
  /** Initial text. Captured once — later changes do NOT re-set the model. */
  value:    string
  language: string
  theme:    string
  onChange: (value: string) => void
  /** Called once with the live editor + monaco namespace (e.g. to register
   *  language extras). */
  onReady?: (editor: CodeEditorInstance, monaco: Monaco) => void
}

export default function CodeEditor({
  value, language, theme, onChange, onReady,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef    = useRef<CodeEditorInstance | null>(null)
  // Frozen once: feeding this back as `value` would re-set the model.
  const initialValue = useRef(value)
  const [geo, setGeo] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setGeo({ width, height })
          // Existing instance (e.g. tab became visible again): force a single
          // synchronous re-layout before any user interaction.
          editorRef.current?.layout({ width, height })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-[var(--bg)]"
    >
      {geo.width > 0 && geo.height > 0 && (
        <Editor
          width={geo.width}
          height={geo.height}
          language={language}
          theme={theme}
          defaultValue={initialValue.current}
          onChange={(v) => { if (v !== undefined) onChange(v) }}
          onMount={(editor, monaco) => {
            editorRef.current = editor
            editor.layout({ width: geo.width, height: geo.height })
            onReady?.(editor, monaco)
          }}
          options={{
            automaticLayout:         false,   // ResizeObserver owns sizing
            fontSize:                14,
            lineHeight:              22,      // freeze vertical metrics
            fontFamily:              "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures:           true,
            minimap:                 { enabled: false },
            scrollBeyondLastLine:    false,
            fixedOverflowWidgets:    true,    // suggest/hover not clipped
            wordWrap:                'on',
            tabSize:                 2,
            folding:                 true,
            renderLineHighlight:     'gutter',
            cursorBlinking:          'smooth',
          }}
        />
      )}
    </div>
  )
}
