import { useEffect, useRef, useState } from 'react'
import { PivotMarker, pivotOffsetInRect } from '../../components/pivot/PivotMarkerOverlay'
import type { AnimationClipDef, ImageAsset } from '../../types'
import { getAssetDefaultPivot } from '../../utils/sprite-pivot-resolve'
import {
  clampPreviewDisplayScale,
  previewDisplayScale,
} from '../spritesheet-studio/SpritesheetEnginePreview'

type InspectorClipPreviewProps = Readonly<{
  asset: ImageAsset
  clipName: string
}>

/** Compact loop preview for Inspector default-clip selection (CSS fallback). */
export function InspectorClipPreview({ asset, clipName }: InspectorClipPreviewProps) {
  const clip = (asset.clips ?? []).find((c) => c.name.trim() === clipName.trim())
  const [previewTick, setPreviewTick] = useState(0)
  const previewRef = useRef(0)

  useEffect(() => {
    previewRef.current = 0
    setPreviewTick(0)
  }, [clip?.name, clip?.frames.length])

  useEffect(() => {
    if (!clip || clip.frames.length === 0) return
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

  if (!clip || clip.frames.length === 0) return null

  const playbackSrc = asset.dataUrl ?? ''
  if (!playbackSrc) return null

  return (
    <InspectorClipFramePreview asset={asset} clip={clip} playbackSrc={playbackSrc} previewTick={previewTick} />
  )
}

function InspectorClipFramePreview({
  asset,
  clip,
  playbackSrc,
  previewTick,
}: Readonly<{
  asset: ImageAsset
  clip: AnimationClipDef
  playbackSrc: string
  previewTick: number
}>) {
  const frame = clip.frames[previewTick]
  if (!frame) return null

  const pivot = getAssetDefaultPivot(asset)
  const scale = clampPreviewDisplayScale(
    frame.w,
    frame.h,
    previewDisplayScale(frame.w, frame.h),
    120,
  )

  return (
    <div
      className="mt-2 rounded border border-[var(--border)] bg-[var(--bg)] p-2 flex flex-col items-center gap-1"
      data-testid="inspector-clip-preview"
    >
      <p className="text-[8px] text-[var(--muted)] uppercase w-full">Clip preview</p>
      <div
        className="relative border border-[var(--border)] overflow-hidden shrink-0"
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
          style={{
            imageRendering: 'pixelated',
            marginLeft: -frame.x,
            marginTop: -frame.y,
          }}
        />
        <PivotMarker
          left={pivotOffsetInRect(pivot, frame.w, frame.h).left * scale}
          top={pivotOffsetInRect(pivot, frame.w, frame.h).top * scale}
          radius={5}
        />
      </div>
      <span className="text-[8px] text-[var(--muted)]">
        {clip.name} · {previewTick + 1}/{clip.frames.length}
      </span>
    </div>
  )
}
