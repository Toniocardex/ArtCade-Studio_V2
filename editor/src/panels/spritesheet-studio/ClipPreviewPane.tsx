import { useEffect, useRef, useState } from 'react'
import { PivotMarker, pivotOffsetInRect } from '../../components/pivot/PivotMarkerOverlay'
import type { ImageAsset } from '../../types'
import { getAssetDefaultPivot } from '../../utils/sprite-pivot-resolve'
import { SpritesheetEnginePreview } from './SpritesheetEnginePreview'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'
import { isReady } from '../../utils/wasm-bridge'

type ClipPreviewPaneProps = Readonly<{
  asset: ImageAsset
  session: SpritesheetStudioSession
}>

export function ClipPreviewPane({ asset, session }: ClipPreviewPaneProps) {
  const { activeClip, previewSrc } = session
  const [previewTick, setPreviewTick] = useState(0)
  const previewRef = useRef(0)

  useEffect(() => {
    previewRef.current = 0
    setPreviewTick(0)
  }, [activeClip?.name, activeClip?.frames.length])

  useEffect(() => {
    if (isReady() || !activeClip || activeClip.frames.length === 0) return
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
  const pivot = getAssetDefaultPivot(asset)
  const fallbackScale = 5

  const playbackSrc = previewSrc ?? asset.dataUrl ?? ''
  const hasPreviewSource = playbackSrc.length > 0

  if (!previewFrame || !hasPreviewSource) {
    return (
      <div
        className="shrink-0 p-3 border-t border-[var(--border)] bg-[var(--panel-3)] text-[10px] text-[var(--muted)]"
        data-testid="spritesheet-preview-host"
      >
        Select frames on the grid to preview playback.
      </div>
    )
  }

  if (isReady()) {
    return (
      <div
        className="shrink-0 p-3 border-t border-[var(--border)] bg-[var(--panel-3)]"
        data-testid="spritesheet-preview-host"
      >
        <SpritesheetEnginePreview asset={asset} session={session} />
      </div>
    )
  }

  return (
    <div
      className="shrink-0 p-3 border-t border-[var(--border)] bg-[var(--panel-3)] flex flex-col items-center gap-2"
      data-testid="spritesheet-preview-host"
    >
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] w-full">Clip preview</p>
      <div
        className="relative border border-[var(--border)] overflow-hidden shrink-0"
        style={{
          width: previewFrame.w * fallbackScale,
          height: previewFrame.h * fallbackScale,
          imageRendering: 'pixelated',
        }}
      >
        <img
          src={playbackSrc}
          alt=""
          draggable={false}
          style={{
            imageRendering: 'pixelated',
            marginLeft: -previewFrame.x,
            marginTop: -previewFrame.y,
          }}
        />
        <PivotMarker
          left={pivotOffsetInRect(pivot, previewFrame.w, previewFrame.h).left}
          top={pivotOffsetInRect(pivot, previewFrame.w, previewFrame.h).top}
          radius={6}
        />
      </div>
      <span className="text-[10px] text-[var(--muted)]">
        Frame {previewTick + 1} / {activeClip.frames.length}
      </span>
    </div>
  )
}
