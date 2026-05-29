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

export function SpritesheetEnginePreview({ asset, session }: SpritesheetEnginePreviewProps) {
  const { activeClip } = session
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const engineOkRef = useRef(false)
  const [engineOk, setEngineOk] = useState(false)

  const texturePath = asset.path?.trim() || asset.id
  const clipName = activeClip?.name ?? ''
  const frameW = activeClip?.frames[0]?.w ?? 64
  const frameH = activeClip?.frames[0]?.h ?? 64
  const pad = 8
  const canvasW = Math.min(256, Math.max(32, frameW + pad * 2))
  const canvasH = Math.min(256, Math.max(32, frameH + pad * 2))

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
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] text-[var(--muted)]">Engine preview</span>
      <canvas
        ref={canvasRef}
        className="border border-[var(--border)]"
        style={{ imageRendering: 'pixelated', width: canvasW, height: canvasH }}
        data-testid="spritesheet-engine-preview-canvas"
      />
      {!isReady() ? (
        <span className="text-[9px] text-[var(--muted)]">WASM runtime not ready.</span>
      ) : !engineOk ? (
        <span className="text-[9px] text-[var(--warn)]">
          Waiting for engine texture or clip sync — save the project if this persists.
        </span>
      ) : (
        <span className="text-[9px] text-[var(--muted)]">{clipName}</span>
      )}
      <span className="text-[9px] text-[var(--muted)] w-full">
        Clip names are global in the runtime — use unique names across all image sheets.
      </span>
    </div>
  )
}
