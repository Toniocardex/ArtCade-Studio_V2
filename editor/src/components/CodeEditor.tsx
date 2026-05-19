// ---------------------------------------------------------------------------
// CodeEditor — native, zero-flicker Monaco wrapper.
//
//  • UNCONTROLLED (anti scroll-jump): initial text frozen in a ref, passed
//    as `defaultValue`. We never feed `value` back, so a store update from
//    onChange can't make @monaco-editor/react re-set the model.
//
//  • MEASURE-FIRST (anti flicker): the Editor is not mounted until a
//    ResizeObserver reports real geometry (>0). Mount gate only — we do NOT
//    drive Monaco's pixel size from React state (an early transient measure
//    left Monaco sized 1224px inside a 478px box → overflow/clipping). The
//    Editor fills the container at 100%/100% with `automaticLayout:false`;
//    the ResizeObserver imperatively calls `editor.layout()` (no args), so
//    Monaco always re-measures its REAL current DOM box — correct even after
//    flex reflow / display:none→visible tab switches.
// ---------------------------------------------------------------------------

import Editor from '@monaco-editor/react'
import type { Monaco, OnMount } from '@monaco-editor/react'
import { useLayoutEffect, useRef, useState } from 'react'

type CodeEditorInstance = Parameters<OnMount>[0]

export interface CodeEditorProps {
  value:    string
  language: string
  theme:    string
  onChange: (value: string) => void
  onReady?: (editor: CodeEditorInstance, monaco: Monaco) => void
}

export default function CodeEditor({
  value, language, theme, onChange, onReady,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef    = useRef<CodeEditorInstance | null>(null)
  const initialValue = useRef(value)            // frozen — never re-fed as value
  const [measured, setMeasured] = useState(false)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const relayout = () => {
      // Auto-measure: Monaco reads its own (correctly 100%-sized) DOM box.
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => editorRef.current?.layout())
    }
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        setMeasured(true)     // unlock the Measure-First mount gate
        relayout()            // and re-fit the existing instance (tab switch)
      }
    })
    observer.observe(el)
    return () => { cancelAnimationFrame(raf); observer.disconnect() }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[var(--bg)]">
      {measured && (
        <Editor
          width="100%"
          height="100%"
          language={language}
          theme={theme}
          defaultValue={initialValue.current}
          onChange={(v) => { if (v !== undefined) onChange(v) }}
          onMount={(editor, monaco) => {
            editorRef.current = editor
            requestAnimationFrame(() => editor.layout())
            onReady?.(editor, monaco)
          }}
          options={{
            automaticLayout:      false,   // ResizeObserver owns sizing
            fontSize:             14,
            lineHeight:           22,      // freeze vertical metrics
            fontFamily:           "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures:        true,
            minimap:              { enabled: false },
            scrollBeyondLastLine: false,
            fixedOverflowWidgets: true,    // suggest/hover not clipped
            wordWrap:             'on',
            tabSize:              2,
            folding:              true,
            renderLineHighlight:  'gutter',
            cursorBlinking:       'smooth',
          }}
        />
      )}
    </div>
  )
}
