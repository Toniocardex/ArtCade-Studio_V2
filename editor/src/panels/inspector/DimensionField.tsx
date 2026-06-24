// ---------------------------------------------------------------------------
// DimensionField — paired W x H numeric field with optional aspect-ratio lock
// ---------------------------------------------------------------------------
//
// Used by the Canvas section for both World and Viewport sizes. When the lock
// is engaged, editing one axis scales the other to preserve the current ratio.
// The aspect-lock state is editor-only (UI), never persisted to the scene.

import { useEffect, useRef } from 'react'
import { Link2, Unlink2 } from 'lucide-react'
import { applyInputBackspace, isBackspaceKey } from '../../utils/keyboard'
import { parseSceneDimension } from './inspector-fields'

type AxisInputProps = Readonly<{
  value: number
  ariaLabel: string
  onCommit: (value: number) => void
}>

/** Uncontrolled numeric input that re-syncs to `value` when not focused. */
function AxisInput({ value, ariaLabel, onCommit }: AxisInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const lastCommitted = useRef(String(value))

  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    el.value = String(value)
    lastCommitted.current = String(value)
  }, [value])

  function commit() {
    const raw = ref.current?.value ?? ''
    if (raw === lastCommitted.current) return
    lastCommitted.current = raw
    onCommit(parseSceneDimension(raw, value))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation()
    if (isBackspaceKey(e)) {
      e.preventDefault()
      applyInputBackspace(e.currentTarget)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      e.currentTarget.blur()
    }
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      defaultValue={String(value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className="editor-input w-14 text-center"
      data-mono
    />
  )
}

export type DimensionFieldProps = Readonly<{
  width: number
  height: number
  locked: boolean
  onToggleLock: () => void
  onCommit: (next: { width: number; height: number }) => void
}>

export function DimensionField({
  width, height, locked, onToggleLock, onCommit,
}: DimensionFieldProps) {
  function commitWidth(nextWidth: number) {
    if (locked && width > 0) {
      const scaled = parseSceneDimension(String(Math.round(nextWidth * (height / width))), height)
      onCommit({ width: nextWidth, height: scaled })
    } else {
      onCommit({ width: nextWidth, height })
    }
  }

  function commitHeight(nextHeight: number) {
    if (locked && height > 0) {
      const scaled = parseSceneDimension(String(Math.round(nextHeight * (width / height))), width)
      onCommit({ width: scaled, height: nextHeight })
    } else {
      onCommit({ width, height: nextHeight })
    }
  }

  const LockIcon = locked ? Link2 : Unlink2

  return (
    <div className="flex items-center gap-1">
      <AxisInput value={width} ariaLabel="Width" onCommit={commitWidth} />
      <button
        type="button"
        aria-label={locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
        aria-pressed={locked}
        title={locked ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
        onClick={onToggleLock}
        className={`w-5 h-5 shrink-0 flex items-center justify-center rounded transition-colors ${
          locked
            ? 'text-[var(--accent)]'
            : 'text-[var(--muted)] hover:text-[var(--text)]'
        }`}
      >
        <LockIcon size={12} aria-hidden />
      </button>
      <AxisInput value={height} ariaLabel="Height" onCommit={commitHeight} />
    </div>
  )
}
