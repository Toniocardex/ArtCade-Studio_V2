// ---------------------------------------------------------------------------
// usePersistedLayout — panel sizes per window resolution bucket (Phase 3)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorLayoutSnapshot } from '../utils/editor-layout-persist'
import { useWorkspaceLayoutMetricsContext } from '../contexts/editor-layout-tier-context'
import {
  clampLeftWidthInWorkspace,
  clampRightWidthInWorkspace,
  defaultLayoutSnapshot,
  readEditorLayoutSnapshot,
  writeEditorLayoutSnapshot,
} from '../utils/editor-layout-persist'

const SAVE_DEBOUNCE_MS = 500

export type PersistedLayoutApi = EditorLayoutSnapshot & {
  bucketWidth: number
  bucketHeight: number
  setLeftW: (next: number | ((prev: number) => number)) => void
  setRightW: (next: number | ((prev: number) => number)) => void
  setDockH: (next: number | ((prev: number) => number)) => void
  setDockCollapsed: (collapsed: boolean) => void
  resetToDefaults: () => void
  resetLeftW: () => void
  resetRightW: () => void
}

export function usePersistedLayout(): PersistedLayoutApi {
  const { width, height } = useWorkspaceLayoutMetricsContext()
  const [snapshot, setSnapshot] = useState<EditorLayoutSnapshot>(() =>
    readEditorLayoutSnapshot(width, height),
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot

  const scheduleSave = useCallback((w: number, h: number, snap: EditorLayoutSnapshot) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      writeEditorLayoutSnapshot(w, h, snap)
    }, SAVE_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    const loaded = readEditorLayoutSnapshot(width, height)
    setSnapshot(loaded)
    snapshotRef.current = loaded
  }, [width, height])

  useEffect(() => {
    scheduleSave(width, height, snapshot)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [width, height, snapshot, scheduleSave])

  const patch = useCallback((partial: Partial<EditorLayoutSnapshot>) => {
    setSnapshot((prev) => {
      const next = { ...prev, ...partial }
      snapshotRef.current = next
      return next
    })
  }, [])

  const setLeftW = useCallback((next: number | ((prev: number) => number)) => {
    setSnapshot((prev) => {
      const raw = typeof next === 'function' ? next(prev.leftW) : next
      const leftW = clampLeftWidthInWorkspace(raw, width, prev.rightW)
      const nextSnap = { ...prev, leftW }
      snapshotRef.current = nextSnap
      return nextSnap
    })
  }, [width])

  const setRightW = useCallback((next: number | ((prev: number) => number)) => {
    setSnapshot((prev) => {
      const raw = typeof next === 'function' ? next(prev.rightW) : next
      const rightW = clampRightWidthInWorkspace(raw, width, prev.leftW)
      const nextSnap = { ...prev, rightW }
      snapshotRef.current = nextSnap
      return nextSnap
    })
  }, [width])

  const setDockH = useCallback((next: number | ((prev: number) => number)) => {
    setSnapshot((prev) => {
      const raw = typeof next === 'function' ? next(prev.dockH) : next
      const dockH = Math.round(raw)
      const nextSnap = { ...prev, dockH }
      snapshotRef.current = nextSnap
      return nextSnap
    })
  }, [])

  const setDockCollapsed = useCallback((dockCollapsed: boolean) => {
    patch({ dockCollapsed })
  }, [patch])

  const resetToDefaults = useCallback(() => {
    const defaults = defaultLayoutSnapshot()
    setSnapshot(defaults)
    writeEditorLayoutSnapshot(width, height, defaults)
  }, [width, height])

  const resetLeftW = useCallback(() => {
    const leftW = defaultLayoutSnapshot().leftW
    patch({ leftW })
  }, [patch])

  const resetRightW = useCallback(() => {
    const rightW = defaultLayoutSnapshot().rightW
    patch({ rightW })
  }, [patch])

  return {
    ...snapshot,
    bucketWidth: width,
    bucketHeight: height,
    setLeftW,
    setRightW,
    setDockH,
    setDockCollapsed,
    resetToDefaults,
    resetLeftW,
    resetRightW,
  }
}
