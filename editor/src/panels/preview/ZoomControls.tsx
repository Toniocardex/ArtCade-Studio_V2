// ---------------------------------------------------------------------------
// ZoomControls — Figma/Affinity-style zoom combobox for the editor canvas
// ---------------------------------------------------------------------------
//
// Layout:  [ − ]  [ 100% ▾ ]  [ + ]
//
//   • [−] / [+]  → step through preset zooms (25/50/75/100/125/150/200/400)
//   • [100% ▾]   → single click opens a preset dropdown
//                  double click enables manual percentage entry (Enter to apply,
//                  Esc to cancel)
//
// Keyboard shortcuts live in App.tsx so they work even when the zoom widget
// has no focus (Ctrl+/-, Ctrl+0, Ctrl+9). The widget is purely declarative:
// it reads `editorZoom` from the store and dispatches `EDITOR_SET_ZOOM`.

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, ChevronDown } from 'lucide-react'

interface ZoomControlsProps {
  zoom:    number               // 1.0 = 100%
  onSet:   (zoom: number) => void
  onFit:   () => void           // Ctrl+9 / dropdown "Fit"
}

/**
 * Industry-standard step sequence (Photoshop / Aseprite / Affinity Designer).
 * Tight steps near 100% (the value most editors use most of the time) and
 * wider steps at the extremes.
 */
const ZOOM_PRESETS = [0.10, 0.25, 0.50, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0]

function nextStep(current: number, dir: 1 | -1): number {
  if (dir > 0) {
    const next = ZOOM_PRESETS.find(z => z > current + 0.001)
    return next ?? ZOOM_PRESETS[ZOOM_PRESETS.length - 1]
  }
  // Walk presets in reverse to find the first one strictly below current.
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    if (ZOOM_PRESETS[i] < current - 0.001) return ZOOM_PRESETS[i]
  }
  return ZOOM_PRESETS[0]
}

function formatPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

export function ZoomControls({ zoom, onSet, onFit }: ZoomControlsProps) {
  const [open, setOpen]         = useState(false)
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState('')
  const inputRef                = useRef<HTMLInputElement>(null)
  const popoverRef              = useRef<HTMLDivElement>(null)

  // Close the dropdown when clicking elsewhere; standard combobox behaviour.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDocClick)
    return () => window.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Autofocus the manual-entry input when entering edit mode.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commitDraft() {
    const n = parseFloat(draft.replace(',', '.').replace('%', ''))
    if (Number.isFinite(n) && n > 0) onSet(n / 100)
    setEditing(false)
    setDraft('')
  }

  function cancelDraft() {
    setEditing(false)
    setDraft('')
  }

  return (
    <div className="relative flex items-center gap-0.5" ref={popoverRef}>
      {/* Minus */}
      <button
        type="button"
        onClick={() => onSet(nextStep(zoom, -1))}
        title="Zoom out (Ctrl+-)"
        className="p-1 rounded text-[var(--muted)] hover:bg-[var(--panel-3)] hover:text-[var(--text)] transition-colors"
      >
        <Minus size={13} />
      </button>

      {/* Combobox label */}
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
                       bg-[var(--bg)] border border-[var(--accent)] rounded
                       text-[var(--text)] outline-none"
          />
        )
        : (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            onDoubleClick={() => { setDraft(String(Math.round(zoom * 100))); setEditing(true) }}
            title={`Zoom: ${formatPercent(zoom)} — click for presets, double-click to type`}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold
                       text-[var(--text)] bg-[var(--bg)]
                       hover:bg-[var(--panel-3)] border border-[var(--border)]
                       min-w-[3.5rem] justify-center transition-colors"
          >
            {formatPercent(zoom)}
            <ChevronDown size={10} className="text-[var(--muted)]" />
          </button>
        )}

      {/* Plus */}
      <button
        type="button"
        onClick={() => onSet(nextStep(zoom, +1))}
        title="Zoom in (Ctrl++)"
        className="p-1 rounded text-[var(--muted)] hover:bg-[var(--panel-3)] hover:text-[var(--text)] transition-colors"
      >
        <Plus size={13} />
      </button>

      {/* Dropdown */}
      {open && !editing && (
        <div className="absolute top-full right-0 mt-1 z-50
                        bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-xl
                        py-1 min-w-[7rem]">
          {ZOOM_PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { onSet(p); setOpen(false) }}
              className={`block w-full text-left px-3 py-1 text-[10px] font-mono
                          hover:bg-[var(--panel-3)] transition-colors
                          ${Math.abs(p - zoom) < 0.001 ? 'text-[var(--accent)] font-bold' : 'text-[var(--text)]'}`}
            >
              {formatPercent(p)}
            </button>
          ))}
          <div className="my-1 h-px bg-[var(--border)]" />
          <button
            type="button"
            onClick={() => { onFit(); setOpen(false) }}
            className="block w-full text-left px-3 py-1 text-[10px] font-bold
                       text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-3)] transition-colors"
            title="Ctrl+9"
          >
            Fit to panel
          </button>
        </div>
      )}
    </div>
  )
}
