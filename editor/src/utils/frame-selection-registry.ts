// ---------------------------------------------------------------------------
// frame-selection-registry — typed bridge for the "F = frame selected" shortcut
// ---------------------------------------------------------------------------
//
// Same pattern as zoom-fit-registry: PreviewPanel owns the scroll ref + the
// selected-entity geometry needed to frame a selection, while the keyboard
// shortcut lives in useViewportShortcuts. The panel registers its handler from
// a layout effect; the shortcut calls invoke().

type FrameHandler = () => void

let activeHandler: FrameHandler | null = null

export const frameSelectionRegistry = {
  /**
   * Register the panel's frame-selection callback. Returns the unregister
   * function — pass it as a `useEffect` cleanup. A later registration replaces
   * an earlier one (HMR / fast refresh) so the latest panel instance wins.
   */
  register(handler: FrameHandler): () => void {
    activeHandler = handler
    return () => {
      if (activeHandler === handler) activeHandler = null
    }
  },

  /** Invoke the registered handler. No-op if no panel is mounted. */
  invoke(): void {
    activeHandler?.()
  },

  /** Test-only escape hatch. */
  __reset(): void {
    activeHandler = null
  },
}
