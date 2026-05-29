import { useEffect, useRef, useState } from 'react'
import type { ImageAsset } from '../../types'
import type { SpritesheetStudioSession } from './useSpritesheetStudioSession'
import {
  editorPreviewSpritesheetReset,
  setSpritesheetPreviewFrameHandler,
  submitSpritesheetPreviewFrame,
} from '../../utils/spritesheet-preview-bridge'
import { isReady } from '../../utils/wasm-bridge'

type SpritesheetEnginePreviewProps = Readonly<{
  asset: ImageAsset
  session: SpritesheetStudioSession
}>

/** CSS scale so small frames (e.g. 16×16) are readable in the clips column. */
export function previewDisplayScale(frameW: number, frameH: number): number {
  const maxDim = Math.max(frameW, frameH, 1)
  const target = 160
  return Math.min(12, Math.max(3, Math.ceil(target / maxDim)))
}

export function SpritesheetEnginePreview({ asset, session }: SpritesheetEnginePreviewProps) {
  const { activeClip } = session
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const engineOkRef = useRef(false)
  const [engineOk, setEngineOk] = useState(false)

  const texturePath = asset.path?.trim() || asset.id
  const clipName = activeClip?.name ?? ''
  const frameW = activeClip?.frames.reduce((m, f) => Math.max(m, f.w), 0) || 64
  const frameH = activeClip?.frames.reduce((m, f) => Math.max(m, f.h), 0) || 64
  const pad = 8
  const canvasW = Math.min(256, Math.max(32, frameW + pad * 2))
  const canvasH = Math.min(256, Math.max(32, frameH + pad * 2))
  const displayScale = previewDisplayScale(frameW, frameH)
  const displayW = canvasW * displayScale
  const displayH = canvasH * displayScale

  const setEngineOkTracked = (ok: boolean) => {
    if (engineOkRef.current === ok) return
    engineOkRef.current = ok
    setEngineOk(ok)
  }

  useEffect(() => {
    editorPreviewSpritesheetReset()
  }, [clipName])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    imageDataRef.current = ctx.createImageData(canvasW, canvasH)

    setSpritesheetPreviewFrameHandler((status, w, h, rgba) => {
      if (!ctx || !imageDataRef.current || w !== canvasW || h !== canvasH) return
      if (status === 0 && rgba) {
        imageDataRef.current.data.set(rgba)
        ctx.putImageData(imageDataRef.current, 0, 0)
        setEngineOkTracked(true)
      } else {
        setEngineOkTracked(false)
      }
    })

    return () => {
      setSpritesheetPreviewFrameHandler(null)
      setEngineOkTracked(false)
    }
  }, [canvasW, canvasH])

  useEffect(() => {
    if (!isReady() || !activeClip || activeClip.frames.length === 0 || !clipName) {
      setEngineOkTracked(false)
      return
    }

    let raf = 0
    let last = performance.now()
    const pump = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      submitSpritesheetPreviewFrame(texturePath, clipName, dt, canvasW, canvasH)
      raf = requestAnimationFrame(pump)
    }
    raf = requestAnimationFrame(pump)
    return () => cancelAnimationFrame(raf)
  }, [activeClip, clipName, texturePath, canvasW, canvasH])

  if (!activeClip || activeClip.frames.length === 0) {
    return (
      <p className="text-[10px] text-[var(--muted)]">
        Select frames on the grid to preview playback.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Engine preview</p>
      <div className="flex justify-center w-full min-h-[120px] items-center rounded border border-[var(--border)] bg-[var(--bg)] p-2">
        <canvas
          ref={canvasRef}
          className="border border-[var(--border-2)]"
          style={{
            imageRendering: 'pixelated',
            width: displayW,
            height: displayH,
          }}
          data-testid="spritesheet-engine-preview-canvas"
        />
      </div>
      {!isReady() ? (
        <span className="text-[9px] text-[var(--muted)]">WASM runtime not ready.</span>
      ) : !engineOk ? (
        <span className="text-[9px] text-[var(--warn)]">
          Waiting for engine texture or clip sync — save the project if this persists.
        </span>
      ) : (
        <span className="text-[9px] text-[var(--muted)] truncate" title={clipName}>
          {clipName}
        </span>
      )}
      <span className="text-[9px] text-[var(--muted)] leading-snug">
        Clip names are global in the runtime — use unique names across all image sheets.
      </span>
    </div>
  )
}
