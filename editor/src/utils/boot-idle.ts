/**
 * Schedule work on an idle slice (spec boot Track C — off the first-paint critical path).
 */
export function scheduleBootIdleTask(cb: () => void): () => void {
  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(cb, { timeout: 2000 })
    return () => globalThis.cancelIdleCallback(id)
  }
  const id = globalThis.setTimeout(cb, 0)
  return () => globalThis.clearTimeout(id)
}
