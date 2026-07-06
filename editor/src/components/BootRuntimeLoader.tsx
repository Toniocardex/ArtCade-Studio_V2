import { useCallback } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import { useRuntimeReadiness } from '../hooks/useRuntimeReadiness'
import {
  useEditorWasmBoot,
  useBootSyncRef,
  useBootSceneSync,
  useBootHandshakeRetry,
  makeRuntimeLogEntry,
} from '../panels/preview/runtime-hooks'

/**
 * Loads game.js during the boot gate with a body-mounted canvas, before
 * PreviewPanel layout can delay or detach the GL surface.
 */
export default function BootRuntimeLoader() {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)
  const bootSyncRef = useBootSyncRef()
  const { syncWasmFromBridge } = useRuntimeReadiness()
  const syncRuntimeUiFlags = useCallback(() => {
    syncWasmFromBridge()
  }, [syncWasmFromBridge])

  useEditorWasmBoot({
    dispatch,
    makeLogEntry: makeRuntimeLogEntry,
    bootSyncRef,
    syncRuntimeUiFlags,
  })

  useBootSceneSync({
    project,
    dispatch,
    makeLogEntry: makeRuntimeLogEntry,
    bootSyncRef,
  })

  useBootHandshakeRetry({
    project,
    dispatch,
    makeLogEntry: makeRuntimeLogEntry,
    bootSyncRef,
  })

  return null
}
