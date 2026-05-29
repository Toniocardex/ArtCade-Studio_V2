import { useEffect, useRef, useState } from 'react'
import type { ImageAsset } from '../../types'
import { SpritesheetEnginePreview } from './SpritesheetEnginePreview'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'
import { isReady } from '../../utils/wasm-bridge'

type ClipPreviewPaneProps = Readonly<{
  asset: ImageAsset
  session: SpritesheetStudioSession
}>

export function ClipPreviewPane({ asset, session }: ClipPreviewPaneProps) {
  const { activeClip } = session
  const [previewTick, setPreviewTick] = useState(0)
  const previewRef = useRef(0)

  useEffect(() => {
    previewRef.current = 0
    setPreviewTick(0)
  }, [activeClip?.name, activeClip?.frames.length])

  useEffect(() => {
    if (!activeClip || activeClip.frames.length === 0) return
    const fps = activeClip.fps > 0 ? activeClip.fps : 12
    const frameMs = 1000 / fps
    let raf = 0
    let last = performance.now()
    let elapsed = 0
    const tick = (now: number) => {
      elapsed += now - last
      last = now
      if (elapsed >= frameMs) {
        elapsed = 0
        previewRef.current = (previewRef.current + 1) % activeClip.frames.length
        setPreviewTick(previewRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeClip, activeClip?.frames.length, activeClip?.fps])

  const previewFrame = activeClip?.frames[previewTick]

  if (!previewFrame || !asset.dataUrl) {
    return (
      <div className="p-3 border-t border-[var(--border)] text-[10px] text-[var(--muted)]">
        Select frames on the grid to preview playback.
      </div>
    )
  }

  if (isReady()) {
    return (
      <div className="p-3 border-t border-[var(--border)]">
        <SpritesheetEnginePreview asset={asset} session={session} />
      </div>
    )
  }

  return (
    <div className="p-3 border-t border-[var(--border)] flex items-center gap-3">
      <span className="text-[10px] text-[var(--muted)]">Playback</span>
      <div
        className="border border-[var(--border)] overflow-hidden"
        style={{ width: previewFrame.w, height: previewFrame.h }}
      >
        <img
          src={asset.dataUrl}
          alt=""
          style={{
            imageRendering: 'pixelated',
            marginLeft: -previewFrame.x,
            marginTop: -previewFrame.y,
          }}
        />
      </div>
      <span className="text-[10px] text-[var(--muted)]">
        Frame {previewTick + 1} / {activeClip.frames.length}
      </span>
    </div>
  )
}
