import { useEffect, useRef, useState } from 'react'
import { PivotMarker, pivotOffsetInRect } from '../../components/pivot/PivotMarkerOverlay'
import type { AnimationClipDef, ImageAsset } from '../../types'
import { getAssetDefaultPivot } from '../../utils/sprite-pivot-resolve'
import { SpritesheetEnginePreview } from './SpritesheetEnginePreview'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'
import { isReady } from '../../utils/wasm-bridge'

type ClipPreviewPaneProps = Readonly<{
  asset: ImageAsset
  session: SpritesheetStudioSession
}>

/** Routes between the live WASM preview and the CSS fallback; owns no animation state. */
export function ClipPreviewPane({ asset, session }: ClipPreviewPaneProps) {
  const { activeClip, previewSrc } = session
  const playbackSrc = previewSrc ?? asset.dataUrl ?? ''
  const hasFrames = (activeClip?.frames.length ?? 0) > 0

  if (!hasFrames || playbackSrc.length === 0) {
    return (
      <div
        className="shrink-0 p-3 border-t border-[var(--border)] bg-[var(--panel-3)] text-[10px] text-[var(--muted)]"
        data-testid="spritesheet-preview-host"
      >
        Select frames on the grid to preview playback.
      </div>
    )
  }

  return (
    <div
      className="shrink-0 p-3 border-t border-[var(--border)] bg-[var(--panel-3)]"
      data-testid="spritesheet-preview-host"
    >
      {isReady() ? (
        <SpritesheetEnginePreview asset={asset} session={session} />
      ) : (
        <ClipPreviewCss asset={asset} clip={activeClip!} playbackSrc={playbackSrc} />
      )}
    </div>
  )
}

/** CSS sprite-offset playback used until the WASM runtime is ready. */
function ClipPreviewCss({
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
  const fallbackScale = 5

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
  const pivotPx = pivotOffsetInRect(pivot, frame.w, frame.h)

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] w-full">Clip preview</p>
      <div
        className="relative border border-[var(--border)] overflow-hidden shrink-0"
        style={{
          width: frame.w * fallbackScale,
          height: frame.h * fallbackScale,
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
        <PivotMarker left={pivotPx.left} top={pivotPx.top} radius={6} />
      </div>
      <span className="text-[10px] text-[var(--muted)]">
        Frame {previewTick + 1} / {clip.frames.length}
      </span>
    </div>
  )
}
