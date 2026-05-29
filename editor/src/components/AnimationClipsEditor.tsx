import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { AnimationClipDef, AnimationFrameRect, ImageAsset } from '../types'

type AnimationClipsEditorProps = Readonly<{
  asset: ImageAsset
  onPatch: (clips: AnimationClipDef[]) => void
}>

function deriveGrid(imgW: number, imgH: number, cellW: number, cellH: number) {
  const cols = cellW > 0 ? Math.max(1, Math.floor(imgW / cellW)) : 1
  const rows = cellH > 0 ? Math.max(1, Math.floor(imgH / cellH)) : 1
  return { cols, rows }
}

function frameKey(fr: AnimationFrameRect): string {
  return `${fr.x},${fr.y},${fr.w},${fr.h}`
}

export function AnimationClipsEditor({ asset, onPatch }: AnimationClipsEditorProps) {
  const clips = asset.clips ?? []
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [cellW, setCellW] = useState(32)
  const [cellH, setCellH] = useState(32)
  const [imgWH, setImgWH] = useState<{ w: number; h: number } | null>(null)
  const [previewTick, setPreviewTick] = useState(0)
  const previewRef = useRef(0)

  const activeClip = clips[activeClipIndex]

  useEffect(() => {
    if (!asset.dataUrl) {
      setImgWH(null)
      return
    }
    const img = new Image()
    img.onload = () => setImgWH({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = asset.dataUrl
  }, [asset.dataUrl, asset.path])

  const grid = useMemo(
    () => (imgWH ? deriveGrid(imgWH.w, imgWH.h, cellW, cellH) : { cols: 0, rows: 0 }),
    [imgWH, cellW, cellH],
  )

  const selectedKeys = useMemo(() => {
    const set = new Set<string>()
    for (const fr of activeClip?.frames ?? []) set.add(frameKey(fr))
    return set
  }, [activeClip])

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

  function updateClips(next: AnimationClipDef[]) {
    onPatch(next.length > 0 ? next : [])
    if (activeClipIndex >= next.length) setActiveClipIndex(Math.max(0, next.length - 1))
  }

  function patchActiveClip(patch: Partial<AnimationClipDef>) {
    if (!activeClip) return
    const next = [...clips]
    next[activeClipIndex] = { ...activeClip, ...patch }
    updateClips(next)
  }

  function toggleCell(col: number, row: number) {
    if (!activeClip || cellW <= 0 || cellH <= 0) return
    const fr: AnimationFrameRect = {
      x: col * cellW,
      y: row * cellH,
      w: cellW,
      h: cellH,
    }
    const key = frameKey(fr)
    const frames = [...activeClip.frames]
    const idx = frames.findIndex((f) => frameKey(f) === key)
    if (idx >= 0) frames.splice(idx, 1)
    else frames.push(fr)
    patchActiveClip({ frames })
  }

  const previewFrame = activeClip?.frames[previewTick]

  return (
    <div className="mt-4 p-3 rounded border border-[var(--border)] bg-[var(--panel)]">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
        Animations — {asset.name}
      </p>

      <div className="flex flex-wrap gap-2 mb-2 items-center">
        <label className="text-[10px] text-[var(--muted)]">
          Cell W
          <input
            type="number"
            min={1}
            className="ml-1 w-14 bg-[var(--bg)] border border-[var(--border-2)] rounded px-1"
            value={cellW}
            onChange={(e) => setCellW(Math.max(1, Number.parseInt(e.target.value, 10) || 32))}
          />
        </label>
        <label className="text-[10px] text-[var(--muted)]">
          Cell H
          <input
            type="number"
            min={1}
            className="ml-1 w-14 bg-[var(--bg)] border border-[var(--border-2)] rounded px-1"
            value={cellH}
            onChange={(e) => setCellH(Math.max(1, Number.parseInt(e.target.value, 10) || 32))}
          />
        </label>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-[var(--accent)]"
          onClick={() => {
            updateClips([
              ...clips,
              { name: `clip_${clips.length + 1}`, frames: [], fps: 12, loop: true },
            ])
            setActiveClipIndex(clips.length)
          }}
        >
          <Plus size={11} /> Add clip
        </button>
      </div>

      {clips.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {clips.map((c, i) => (
            <button
              key={c.name + i}
              type="button"
              onClick={() => setActiveClipIndex(i)}
              className={`px-2 py-0.5 rounded text-[10px] border ${
                i === activeClipIndex
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {activeClip && (
        <div className="flex flex-wrap gap-2 mb-2 items-center text-[10px]">
          <input
            className="bg-[var(--bg)] border border-[var(--border-2)] rounded px-1"
            value={activeClip.name}
            onChange={(e) => patchActiveClip({ name: e.target.value })}
          />
          <label className="text-[var(--muted)]">
            FPS
            <input
              type="number"
              min={1}
              className="ml-1 w-12 bg-[var(--bg)] border border-[var(--border-2)] rounded px-1"
              value={activeClip.fps}
              onChange={(e) =>
                patchActiveClip({ fps: Math.max(1, Number.parseFloat(e.target.value) || 12) })
              }
            />
          </label>
          <label className="flex items-center gap-1 text-[var(--muted)]">
            <input
              type="checkbox"
              checked={activeClip.loop}
              onChange={(e) => patchActiveClip({ loop: e.target.checked })}
            />
            Loop
          </label>
          <button
            type="button"
            className="text-[var(--danger)] flex items-center gap-1"
            onClick={() => updateClips(clips.filter((_, i) => i !== activeClipIndex))}
          >
            <Trash2 size={11} /> Remove clip
          </button>
        </div>
      )}

      {asset.dataUrl && imgWH && activeClip && (
        <div className="flex gap-3 flex-wrap">
          <div
            className="relative border border-[var(--border-2)] overflow-auto max-w-full"
            style={{ maxHeight: 200 }}
          >
            <img
              src={asset.dataUrl}
              alt=""
              className="block max-w-none"
              style={{ imageRendering: 'pixelated', width: imgWH.w, height: imgWH.h }}
            />
            <div
              className="absolute inset-0 grid pointer-events-auto"
              style={{
                gridTemplateColumns: `repeat(${grid.cols}, ${cellW}px)`,
                gridTemplateRows: `repeat(${grid.rows}, ${cellH}px)`,
                width: grid.cols * cellW,
                height: grid.rows * cellH,
              }}
            >
              {Array.from({ length: grid.cols * grid.rows }, (_, i) => {
                const col = i % grid.cols
                const row = Math.floor(i / grid.cols)
                const key = frameKey({ x: col * cellW, y: row * cellH, w: cellW, h: cellH })
                const on = selectedKeys.has(key)
                return (
                  <button
                    key={key}
                    type="button"
                    className={`border border-[rgb(255_255_255/0.15)] ${
                      on ? 'bg-[rgb(var(--accent-rgb)/0.35)]' : 'bg-transparent hover:bg-[rgb(255_255_255/0.08)]'
                    }`}
                    onClick={() => toggleCell(col, row)}
                  />
                )
              })}
            </div>
          </div>

          {previewFrame && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-[var(--muted)]">Preview</span>
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
            </div>
          )}
        </div>
      )}

      {!asset.dataUrl && (
        <p className="text-[10px] text-[var(--muted)]">
          Save or re-import the image to slice animation frames on the sheet.
        </p>
      )}
    </div>
  )
}
