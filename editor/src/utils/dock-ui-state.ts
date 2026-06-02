// ---------------------------------------------------------------------------
// dock-ui-state — pure bottom-dock UI state (visibility, collapse, consoleOpen)
// ---------------------------------------------------------------------------

import {
  countVisibleDockPanels,
  DEFAULT_DOCK_PANEL_VISIBILITY,
  type DockPanelId,
  type DockPanelVisibility,
} from '../constants/dock-panels'

export type DockUiSlice = Readonly<{
  bottomPanelCollapsed: boolean
  dockPanelVisibility: DockPanelVisibility
  consoleOpen: boolean
}>

/** Ensure at least one panel is visible; otherwise restore product defaults. */
export function normalizeDockPanelVisibility(
  visibility: DockPanelVisibility,
): DockPanelVisibility {
  if (countVisibleDockPanels(visibility) === 0) {
    return { ...DEFAULT_DOCK_PANEL_VISIBILITY }
  }
  return visibility
}

export function deriveConsoleOpen(
  bottomPanelCollapsed: boolean,
  dockPanelVisibility: DockPanelVisibility,
): boolean {
  return !bottomPanelCollapsed && dockPanelVisibility.console
}

export function withDerivedConsoleOpen<T extends DockUiSlice>(slice: T): T {
  return {
    ...slice,
    consoleOpen: deriveConsoleOpen(slice.bottomPanelCollapsed, slice.dockPanelVisibility),
  }
}

export function applyDockVisibility(
  state: DockUiSlice,
  visibility: DockPanelVisibility,
): DockUiSlice {
  const dockPanelVisibility = normalizeDockPanelVisibility(visibility)
  const visibleCount = countVisibleDockPanels(dockPanelVisibility)
  let bottomPanelCollapsed = state.bottomPanelCollapsed
  if (visibleCount === 0) {
    bottomPanelCollapsed = true
  } else if (state.bottomPanelCollapsed) {
    bottomPanelCollapsed = false
  }
  return withDerivedConsoleOpen({
    bottomPanelCollapsed,
    dockPanelVisibility,
    consoleOpen: state.consoleOpen,
  })
}

export function expandDockWithConsole(state: DockUiSlice): DockUiSlice {
  const visibility = state.dockPanelVisibility.console
    ? state.dockPanelVisibility
    : { ...state.dockPanelVisibility, console: true }
  return withDerivedConsoleOpen({
    bottomPanelCollapsed: false,
    dockPanelVisibility: normalizeDockPanelVisibility(visibility),
    consoleOpen: state.consoleOpen,
  })
}

export function setDockPanelVisible(
  state: DockUiSlice,
  panel: DockPanelId,
  visible: boolean,
): DockUiSlice | null {
  if (!visible && state.dockPanelVisibility[panel]) {
    if (countVisibleDockPanels(state.dockPanelVisibility) <= 1) {
      return null
    }
  }
  if (visible === state.dockPanelVisibility[panel]) {
    return null
  }
  const visibility = { ...state.dockPanelVisibility, [panel]: visible }
  return applyDockVisibility(state, visibility)
}

export function toggleConsoleDock(state: DockUiSlice): DockUiSlice {
  if (state.bottomPanelCollapsed) {
    return expandDockWithConsole(state)
  }
  if (state.consoleOpen) {
    if (countVisibleDockPanels(state.dockPanelVisibility) > 1) {
      return setDockPanelVisible(state, 'console', false) ?? state
    }
    return withDerivedConsoleOpen({ ...state, bottomPanelCollapsed: true })
  }
  return setDockPanelVisible(state, 'console', true) ?? state
}

export function revealConsoleOnLog(state: DockUiSlice): DockUiSlice | null {
  const needExpand = state.bottomPanelCollapsed
  const needConsole = !state.dockPanelVisibility.console
  if (!needExpand && !needConsole) {
    return null
  }
  return expandDockWithConsole(state)
}

/** Boot slice with derived `consoleOpen` from visibility + collapse flag. */
export function createInitialDockUiSlice(
  dockPanelVisibility: DockPanelVisibility,
  bottomPanelCollapsed = false,
): DockUiSlice {
  return withDerivedConsoleOpen({
    bottomPanelCollapsed,
    dockPanelVisibility: normalizeDockPanelVisibility(dockPanelVisibility),
    consoleOpen: false,
  })
}

export function mergeDockUiSlice<S extends DockUiSlice>(state: S, slice: DockUiSlice): S {
  return { ...state, ...slice }
}
