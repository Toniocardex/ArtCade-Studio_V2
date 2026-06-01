import { useMemo } from 'react'
import { useEditor } from '../../store/editor-store'
import {
  countVisibleDockPanels,
  DOCK_PANEL_LABELS,
  DOCK_PANEL_ORDER,
  type DockPanelId,
} from '../../constants/dock-panels'

function DockPanelMenuItem({
  id,
  checked,
  disabled,
  onToggle,
}: Readonly<{
  id: DockPanelId
  checked: boolean
  disabled: boolean
  onToggle: () => void
}>) {
  const label = DOCK_PANEL_LABELS[id]
  const stub = id === 'timeline' || id === 'events'

  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      title={stub ? `${label} (preview UI)` : undefined}
      className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]
                 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
      onClick={onToggle}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none ${
          checked
            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-app)]'
            : 'border-[var(--outline)] bg-transparent'
        }`}
        aria-hidden
      >
        {checked ? '✓' : ''}
      </span>
      {label}
    </button>
  )
}

/** View menu — bottom dock panel visibility toggles. */
export function DockPanelsViewSection() {
  const { state, dispatch } = useEditor()
  const { dockPanelVisibility, bottomPanelCollapsed } = state

  const visibleCount = useMemo(
    () => countVisibleDockPanels(dockPanelVisibility),
    [dockPanelVisibility],
  )

  return (
    <>
      <div className="px-3 py-1.5 border-t border-b border-[var(--outline-subtle)]">
        <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">
          Bottom panels
        </span>
      </div>
      {DOCK_PANEL_ORDER.map((id) => (
        <DockPanelMenuItem
          key={id}
          id={id}
          checked={dockPanelVisibility[id]}
          disabled={dockPanelVisibility[id] && visibleCount <= 1}
          onToggle={() =>
            dispatch({ type: 'TOGGLE_DOCK_PANEL', panel: id })
          }
        />
      ))}
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={!bottomPanelCollapsed}
        className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]
                   flex items-center gap-2 border-t border-[var(--outline-subtle)]"
        onClick={() =>
          dispatch({
            type: 'SET_BOTTOM_PANEL_COLLAPSED',
            collapsed: !bottomPanelCollapsed,
          })
        }
      >
        <span
          className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none ${
            !bottomPanelCollapsed
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-app)]'
              : 'border-[var(--outline)] bg-transparent'
          }`}
          aria-hidden
        >
          {!bottomPanelCollapsed ? '✓' : ''}
        </span>
        Show bottom dock
      </button>
    </>
  )
}
