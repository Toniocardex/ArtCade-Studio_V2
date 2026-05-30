import { useEffect, useMemo, useRef, useState } from 'react'
import { PivotMarker, pivotOffsetInRect } from '../../components/pivot/PivotMarkerOverlay'
import type { AnimationClipDef, ImageAsset } from '../../types'
import { getAssetDefaultPivot } from '../../utils/sprite-pivot-resolve'
import { isReady } from '../../utils/wasm-bridge'
import {
  clampPreviewDisplayScale,
  previewDisplayScale,
} from '../spritesheet-studio/SpritesheetEnginePreview'
import { SpritesheetEnginePreview } from '../spritesheet-studio/SpritesheetEnginePreview'
import type { SpritesheetStudioSession } from '../spritesheet-studio/useSpritesheetStudioSession'

type InspectorClipPreviewProps = Readonly<{
  asset: ImageAsset
  clipName: string
}>

/** Compact loop preview for Inspector default-clip selection. */
export function InspectorClipPreview({ asset, clipName }: InspectorClipPreviewProps) {
  const clip = useMemo(
    () => (asset.clips ?? []).find((c) => c.name.trim() === clipName.trim()),
    [asset.clips, clipName],
  )
  const playbackSrc = asset.dataUrl ?? ''
  const wasmSession = useMemo((): SpritesheetStudioSession | null => {
    if (!clip) return null
    return { activeClip: clip, previewSrc: playbackSrc || null } as SpritesheetStudioSession
  }, [clip, playbackSrc])

  if (!clip || clip.frames.length === 0 || !playbackSrc) return null

  if (isReady() && wasmSession) {
    return (
      <div
        className="mt-2 rounded border border-[var(--border)] bg-[var(--bg)] p-2"
        data-testid="inspector-clip-preview"
      >
        <SpritesheetEnginePreview asset={asset} session={wasmSession} />
      </div>
    )
  }

  return (
    <InspectorClipCssPreview
      asset={asset}
      clip={clip}
      playbackSrc={playbackSrc}
    />
  )
}

function InspectorClipCssPreview({
  asset,
  clip,
  playbackSrc,
}: Readonly<{
  asset: ImageAsset
  clip: AnimationClipDef
  playbackSrc: string
}>) {
  const [previewTick, setPreviewTick] = useState(0)
  const previewRef = useRef(0)

  useEffect(() => {
    previewRef.current = 0
    setPreviewTick(0)
  }, [clip.name, clip.frames.length])

  useEffect(() => {
    if (clip.frames.length === 0) return
    const fps = clip.fps > 0 ? clip.fps : 12
    const frameMs = 1000 / fps
    let raf = 0
    let last = performance.now()
    let elapsed = 0
    const tick = (now: number) => {
      elapsed += now - last
      last = now
      if (elapsed >= frameMs) {
        elapsed = 0
        previewRef.current = (previewRef.current + 1) % clip.frames.length
        setPreviewTick(previewRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clip])

  const frame = clip.frames[previewTick]
  if (!frame) return null

  const pivot = getAssetDefaultPivot(asset)
  const scale = clampPreviewDisplayScale(
    frame.w,
    frame.h,
    previewDisplayScale(frame.w, frame.h),
    120,
  )
  const pivotPx = pivotOffsetInRect(pivot, frame.w, frame.h)

  return (
    <div
      className="mt-2 rounded border border-[var(--border)] bg-[var(--bg)] p-2 flex flex-col items-center gap-1"
      data-testid="inspector-clip-preview"
    >
      <p className="text-[8px] text-[var(--muted)] uppercase w-full">Clip preview</p>
      <div
        className="flex justify-center items-center w-full min-h-[100px] rounded border border-[var(--border)] bg-[var(--panel-3)] p-2 box-border"
      >
        <div
          className="relative overflow-hidden shrink-0"
          style={{
            width: frame.w * scale,
            height: frame.h * scale,
            imageRendering: 'pixelated',
          }}
        >
          <img
            src={playbackSrc}
            alt=""
            draggable={false}
            className="absolute max-w-none pointer-events-none"
            style={{
              imageRendering: 'pixelated',
              left: -frame.x * scale,
              top: -frame.y * scale,
            }}
          />
          <PivotMarker
            left={pivotPx.left * scale}
            top={pivotPx.top * scale}
            radius={5}
          />
        </div>
      </div>
      <span className="text-[8px] text-[var(--muted)]">
        {clip.name} · {previewTick + 1}/{clip.frames.length}
      </span>
    </div>
  )
}
