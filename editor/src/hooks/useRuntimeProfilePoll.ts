import { useEffect, useState } from 'react'
import {
  getRuntimeProfileSample,
  clearRuntimeProfileSample,
  type RuntimeProfileSample,
} from '../utils/runtime-profile-buffer'
import { isReady as isWasmReady } from '../utils/wasm-bridge'

export type RuntimeProfileView = RuntimeProfileSample

const EMPTY: RuntimeProfileView = {
  fps: 0,
  luaMs: 0,
  physicsMs: 0,
  renderMs: 0,
  entityCount: 0,
  physicsBodies: 0,
}

/** Reads WASM profile samples pushed each frame (World Settings → show runtime stats). */
export function useRuntimeProfilePoll(enabled: boolean, isPlaying: boolean): RuntimeProfileView {
  const [profile, setProfile] = useState<RuntimeProfileView>(EMPTY)

  useEffect(() => {
    if (!enabled || !isPlaying || !isWasmReady()) {
      clearRuntimeProfileSample()
      setProfile(EMPTY)
      return
    }

    let frameId = 0
    const tick = () => {
      setProfile(getRuntimeProfileSample())
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [enabled, isPlaying])

  return profile
}
