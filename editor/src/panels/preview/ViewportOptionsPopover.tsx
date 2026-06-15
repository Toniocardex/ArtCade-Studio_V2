// ---------------------------------------------------------------------------
// ViewportOptionsPopover — editor-only viewport view preferences
// ---------------------------------------------------------------------------
//
// Grid + ruler display options live here (in the canvas toolbar) rather than in
// the Inspector, because they are editor view preferences — NOT scene/project
// data saved in the .artcade. Keeps the Inspector focused on the scene itself.

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'

/** Compact number entry that commits on blur / Enter (Esc reverts). */
function NumberRow({
  label, value, onCommit,
}: Readonly<{ label: string; value: number; onCommit: (n: number) => void }>) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])

  function commit() {
    const n = Number.parseFloat(draft.replace(',', '.'))
    if (Number.isFinite(n)) onCommit(n)
    else setDraft(String(value))
  }

  return (
    <label className="flex items-center justify-between gap-2 py-1 text-[10px] text-[var(--muted)] select-none">
      <span>{label}</span>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter')  { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur() }
          if (e.key === 'Escape') { e.preventDefault(); setDraft(String(value)); (e.target as HTMLInputElement).blur() }
        }}
        inputMode="numeric"
        className="w-16 px-2 py-0.5 text-[10px] text-right bg-[var(--bg)]
                   border border-[var(--border)] rounded text-[var(--text)] outline-none
                   focus:border-[var(--accent)]"
      />
    </label>
  )
}

function CheckboxRow({
  label, checked, onToggle,
}: Readonly<{ label: string; checked: boolean; onToggle: () => void }>) {
  return (
    <label className="flex items-center gap-2 py-1 text-[10px] text-[var(--muted)] cursor-pointer select-none hover:text-[var(--text)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-[var(--accent)]"
      />
      <span>{label}</span>
    </label>
  )
}

export function ViewportOptionsPopover() {
  const dispatch = useEditorDispatch()
  const showGrid      = useEditorSelector((s) => s.editorGuidesVisible)
  const gridSize      = useEditorSelector((s) => s.editorGridSize)
  const snapToGrid    = useEditorSelector((s) => s.snapToGrid)
  const rulersVisible = useEditorSelector((s) => s.editorRulersVisible)
  const rulerStep     = useEditorSelector((s) => s.editorRulerStep)

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    globalThis.addEventListener('mousedown', onDocClick)
    return () => globalThis.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Viewport options — grid & rulers"
        className={`p-1.5 rounded transition-colors ${
          open ? 'bg-[rgb(var(--accent-rgb)/0.18)]' : 'hover:bg-[var(--panel-3)]'
        }`}
      >
        <SlidersHorizontal size={15} color={open ? 'var(--accent)' : 'var(--muted)'} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-52
                        bg-[var(--panel)] border border-[var(--border-2)] rounded
                        p-3 shadow-lg">
          <div className="text-[9px] uppercase text-[var(--muted)] tracking-wide mb-1">Grid</div>
          <CheckboxRow label="Show grid" checked={showGrid}
            onToggle={() => dispatch({ type: 'TOGGLE_EDITOR_GUIDES' })} />
          <CheckboxRow label="Snap to grid" checked={snapToGrid}
            onToggle={() => dispatch({ type: 'SET_SNAP_TO_GRID', enabled: !snapToGrid })} />
          <NumberRow label="Size (px)" value={gridSize}
            onCommit={(n) => dispatch({ type: 'EDITOR_SET_GRID_SIZE', tileSize: n })} />

          <div className="my-2 h-px bg-[var(--border)]" />

          <div className="text-[9px] uppercase text-[var(--muted)] tracking-wide mb-1">Rulers</div>
          <CheckboxRow label="Show rulers" checked={rulersVisible}
            onToggle={() => dispatch({ type: 'SET_RULERS_VISIBLE', visible: !rulersVisible })} />
          <NumberRow label="Step (px)" value={rulerStep}
            onCommit={(n) => dispatch({ type: 'EDITOR_SET_RULER_STEP', step: n })} />
        </div>
      )}
    </div>
  )
}
