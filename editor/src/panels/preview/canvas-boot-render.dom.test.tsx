/**
 * @vitest-environment happy-dom
 */
import { useEffect, useRef } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loadWasmRuntime, wasmReady } = vi.hoisted(() => ({
  loadWasmRuntime: vi.fn(),
  wasmReady: { value: false },
}))

vi.mock('../../utils/wasm-bridge', () => ({
  isReady: () => wasmReady.value,
  loadWasmRuntime: (...args: unknown[]) => loadWasmRuntime(...args),
  warmWasmBinary: vi.fn(),
  editorRegisterImage: vi.fn(),
}))

vi.mock('../../utils/asset-watcher', () => ({
  watchProjectAssets: vi.fn(() => Promise.resolve(() => undefined)),
}))

import { EditorProvider, useEditorDispatch } from '../../store/editor-store'
import { EditorLayoutTierProvider } from '../../contexts/editor-layout-tier-context'
import { EditorLayoutProvider } from '../../contexts/editor-layout-context'
import { createBlankProject } from '../../utils/project'
import { starterInnkeeperScript } from '../../utils/dialog/dialog-file-api'
import { resetBootSessionMarker } from '../../utils/boot-session'

const PreviewPanel = (await import('../PreviewPanel')).default

function BootLoader() {
  const dispatch = useEditorDispatch()
  useEffect(() => {
    dispatch({
      type: 'LOAD_PROJECT',
      project: createBlankProject('Untitled'),
      path: '',
      dialogs: { innkeeper: starterInnkeeperScript() },
      selectedDialogId: 'innkeeper',
    })
    dispatch({
      type: 'LOG',
      entry: { id: 501, time: '12:00:00', message: 'boot', level: 'info' },
    })
  }, [dispatch])
  return null
}

function Fixture() {
  const workspaceRef = useRef<HTMLDivElement>(null)
  return (
    <EditorProvider>
      <EditorLayoutTierProvider workspaceRef={workspaceRef}>
        <EditorLayoutProvider>
          <div ref={workspaceRef} style={{ width: 1920, height: 1080 }}>
            <BootLoader />
            <PreviewPanel activeTool="select" onSelectTool={() => undefined} />
          </div>
        </EditorLayoutProvider>
      </EditorLayoutTierProvider>
    </EditorProvider>
  )
}

describe('Canvas boot render (minimal)', () => {
  beforeEach(() => {
    resetBootSessionMarker()
    wasmReady.value = false
    Object.defineProperty(globalThis, 'innerWidth', { value: 1920, writable: true, configurable: true })
    Object.defineProperty(globalThis, 'innerHeight', { value: 1080, writable: true, configurable: true })
    loadWasmRuntime.mockReset()
    loadWasmRuntime.mockImplementation((_c, _s, callbacks) => {
      wasmReady.value = true
      callbacks?.onReady?.()
      return Promise.resolve()
    })
  })

  afterEach(() => cleanup())

  it('survives LOAD_PROJECT without maximum update depth', () => {
    expect(() => {
      act(() => { render(<Fixture />) })
    }).not.toThrow()
  })
})
