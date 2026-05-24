// ---------------------------------------------------------------------------
// zoom-fit-registry — typed bridge between keyboard shortcuts and PreviewPanel
// ---------------------------------------------------------------------------
//
// PreviewPanel owns the scroll-container ref needed to compute "fit to panel"
// zoom. App.tsx owns Ctrl+9 because shortcuts live there. We used to wire
// these two with a `window.dispatchEvent(new CustomEvent('artcade:zoom-fit'))`
// — untyped, hard to test, and required an eslint-disable on the listener.
//
// A small registry exposes a typed `invoke()` that the shortcut calls and a
// matching `register()` PreviewPanel calls from a layout effect. Same idea,
// no global event bus.

type FitHandler = () => void

let activeHandler: FitHandler | null = null

export const zoomFitRegistry = {
  /**
   * Register the panel's `fitZoom` callback. The return value is the
   * unregister function — pass it as a `useEffect` cleanup.
   * If a handler was already registered (HMR / fast refresh) it is replaced
   * so the latest panel instance wins.
   */
  register(handler: FitHandler): () => void {
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
