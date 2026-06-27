/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRuntimeReadiness } from './useRuntimeReadiness'

const onReadyChange = vi.fn()
const onEngineReadyChange = vi.fn()
const onBootProjectSyncedChange = vi.fn()
let wasmReady = false
let engineReady = false
let bootProjectSynced = false

vi.mock('../utils/wasm-bridge', () => ({
  isReady: () => wasmReady,
}))

vi.mock('../utils/runtime-sync-service', () => ({
  runtimeSync: {
    isEngineReady: () => engineReady,
    onReadyChange: (cb: (ready: boolean) => void) => {
      onReadyChange(cb)
      cb(wasmReady)
      return () => { onReadyChange.mockClear() }
    },
    onEngineReadyChange: (cb: (ready: boolean) => void) => {
      onEngineReadyChange(cb)
      cb(engineReady)
      return () => { onEngineReadyChange.mockClear() }
    },
    isBootProjectSynced: () => bootProjectSynced,
    onBootProjectSyncedChange: (cb: (synced: boolean) => void) => {
      onBootProjectSyncedChange(cb)
      cb(bootProjectSynced)
      return () => { onBootProjectSyncedChange.mockClear() }
    },
  },
}))

beforeEach(() => {
  wasmReady = false
  engineReady = false
  bootProjectSynced = false
  onReadyChange.mockClear()
  onEngineReadyChange.mockClear()
  onBootProjectSyncedChange.mockClear()
})

describe('useRuntimeReadiness', () => {
  it('seeds wasm and engine flags from bridge singletons', () => {
    wasmReady = true
    engineReady = true
    const { result } = renderHook(() => useRuntimeReadiness())
    expect(result.current.wasmReady).toBe(true)
    expect(result.current.engineReady).toBe(true)
  })

  it('syncWasmFromBridge sets wasm when module is ready', () => {
    const { result } = renderHook(() => useRuntimeReadiness())
    expect(result.current.wasmReady).toBe(false)
    wasmReady = true
    act(() => { result.current.syncWasmFromBridge() })
    expect(result.current.wasmReady).toBe(true)
  })

  it('tracks engine readiness via runtimeSync subscription', () => {
    const { result } = renderHook(() => useRuntimeReadiness())
    const engineCb = onEngineReadyChange.mock.calls[0]?.[0]
    expect(engineCb).toBeTypeOf('function')
    act(() => { engineCb(true) })
    expect(result.current.engineReady).toBe(true)
  })
})
