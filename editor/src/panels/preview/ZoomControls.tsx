// ---------------------------------------------------------------------------
// ZoomControls — Figma/Affinity-style zoom combobox for the editor canvas
// ---------------------------------------------------------------------------
//
// Layout:  [ − ]  [ 100% ▾ ]  [ + ]
//
//   • [−] / [+]  → step through preset zooms (see ZOOM_PRESETS)
//   • [100% ▾]   → single click opens a preset dropdown
//                  double click enables manual percentage entry (Enter to apply,
//                  Esc to cancel)
//
// Keyboard shortcuts live in App.tsx so they work even when this widget has
// no focus (Ctrl+/-, Ctrl+0, Ctrl+9). The component is self-contained: it
// reads `editorZoom` from the store, dispatches `EDITOR_SET_ZOOM`, and asks
// PreviewPanel to fit through `zoomFitRegistry`.

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, ChevronDown } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { formatZoomPercent, nextZoomStep } from '../../utils/editor-zoom'
import { zoomFitRegistry } from '../../utils/zoom-fit-registry'
import { ZOOM_PRESETS, ZOOM_PRESET_EPSILON } from '../../constants/editor-viewport'

export function ZoomControls() {
  const dispatch = useEditorDispatch()
  const zoom = useEditorSelector((s) => s.editorZoom)
  const fitMode = useEditorSelector((s) => s.editorZoomMode === 'fit')

  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const inputRef              = useRef<HTMLInputElement>(null)
  const popoverRef            = useRef<HTMLDivElement>(null)

  function setZoom(z: number) {
    dispatch({ type: 'EDITOR_SET_ZOOM', zoom: z })
  }

  // Close the dropdown when clicking elsewhere; standard combobox behaviour.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    globalThis.addEventListener('mousedown', onDocClick)
    return () => globalThis.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Autofocus the manual-entry input when entering edit mode.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commitDraft() {
    const n = Number.parseFloat(draft.replace(',', '.').replace('%', ''))
    if (Number.isFinite(n) && n > 0) setZoom(n / 100)
    setEditing(false)
    setDraft('')
  }

  function cancelDraft() {
    setEditing(false)
    setDraft('')
  }

  return (
    <div className="relative flex items-center gap-0.5" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setZoom(nextZoomStep(zoom, -1))}
        title="Zoom out (Ctrl+-)"
        className="p-1 rounded text-[var(--muted)] hover:bg-[var(--panel-3)] hover:text-[var(--text)] transition-colors"
      >
        <Minus size={13} />
      </button>

      {editing
        ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); commitDraft() }
              if (e.key === 'Escape') { e.preventDefault(); cancelDraft() }
            }}
            placeholder="100"
            className="w-14 px-2 py-0.5 text-[10px] font-bold text-center
                       bg-[var(--bg)] border border-[var(--accent-2)] rounded
                       text-[var(--text)] outline-none"
          />
        )
        : (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            onDoubleClick={() => { setDraft(String(Math.round(zoom * 100))); setEditing(true) }}
            title={fitMode
              ? `Fit to panel (${formatZoomPercent(zoom)}) — click for presets, double-click to type`
              : `Zoom: ${formatZoomPercent(zoom)} — click for presets, double-click to type`}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold
                       bg-[var(--bg)]
                       hover:bg-[var(--panel-3)] border min-w-[3.5rem] justify-center transition-colors
                       ${fitMode
                         ? 'text-[var(--accent-2)] border-[var(--accent-2)]'
                         : 'text-[var(--text)] border-[var(--border)]'}`}
          >
            {fitMode ? `FIT ${formatZoomPercent(zoom)}` : formatZoomPercent(zoom)}
            <ChevronDown size={10} className="text-[var(--muted)]" />
          </button>
        )}

      <button
        type="button"
        onClick={() => setZoom(nextZoomStep(zoom, +1))}
        title="Zoom in (Ctrl++)"
        className="p-1 rounded text-[var(--muted)] hover:bg-[var(--panel-3)] hover:text-[var(--text)] transition-colors"
      >
        <Plus size={13} />
      </button>

      {open && !editing && (
        <div className="absolute top-full right-0 mt-1 z-50
                        bg-[var(--panel)] border border-[var(--border-2)] rounded
                        py-1 min-w-[7rem]">
          {ZOOM_PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setZoom(p); setOpen(false) }}
              className={`block w-full text-left px-3 py-1 text-[10px] font-mono
                          hover:bg-[var(--panel-3)] transition-colors
                          ${Math.abs(p - zoom) < ZOOM_PRESET_EPSILON ? 'text-[var(--accent-2)] font-bold' : 'text-[var(--text)]'}`}
            >
              {formatZoomPercent(p)}
            </button>
          ))}
          <div className="my-1 h-px bg-[var(--border)]" />
          <button
            type="button"
            onClick={() => { zoomFitRegistry.invoke(); setOpen(false) }}
            className={`block w-full text-left px-3 py-1 text-[10px] font-bold
                       hover:bg-[var(--panel-3)] transition-colors
                       ${fitMode
                         ? 'text-[var(--accent-2)]'
                         : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
            title="Ctrl+9 — keeps the scene fully visible when the panel is resized"
          >
            Fit to panel{fitMode ? ' ✓' : ''}
          </button>
        </div>
      )}
    </div>
  )
}
