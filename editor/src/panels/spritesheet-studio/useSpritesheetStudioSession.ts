import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AnimationClipDef, ImageAsset } from '../../types'
import {
  deriveGrid,
  frameAtCell,
  frameKey,
  frameRangeFromFrames,
  framesToSortedIndices,
  indicesRangeToFrames,
  indicesSetToFrames,
  type FrameRangeUi,
} from '../../utils/spritesheet-studio'

export type SpritesheetStudioSession = Readonly<{
  cellW: number
  cellH: number
  setCellW: (n: number) => void
  setCellH: (n: number) => void
  imgWH: { w: number; h: number } | null
  grid: ReturnType<typeof deriveGrid>
  activeClipIndex: number
  setActiveClipIndex: (i: number) => void
  activeClip: AnimationClipDef | undefined
  clips: AnimationClipDef[]
  selectedKeys: Set<string>
  rangeUi: FrameRangeUi | null
  toggleCell: (col: number, row: number) => void
  setRange: (start: number, end: number) => void
  patchActiveClip: (patch: Partial<AnimationClipDef>) => void
  updateClips: (next: AnimationClipDef[]) => void
  addClip: () => void
  removeActiveClip: () => void
}>

export function useSpritesheetStudioSession(
  asset: ImageAsset,
  onPatchClips: (clips: AnimationClipDef[]) => void,
): SpritesheetStudioSession {
  const clips = asset.clips ?? []
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const inferCell = (clipsList: AnimationClipDef[]): { w: number; h: number } => {
    for (const clip of clipsList) {
      const fr = clip.frames.find((f) => f.w > 0 && f.h > 0)
      if (fr) return { w: fr.w, h: fr.h }
    }
    return { w: 32, h: 32 }
  }

  const [cellW, setCellW] = useState(() => inferCell(asset.clips ?? []).w)
  const [cellH, setCellH] = useState(() => inferCell(asset.clips ?? []).h)
  const [imgWH, setImgWH] = useState<{ w: number; h: number } | null>(null)

  const activeClip = clips[activeClipIndex]

  useEffect(() => {
    const inferred = inferCell(asset.clips ?? [])
    setCellW(inferred.w)
    setCellH(inferred.h)
  }, [asset.path])

  useEffect(() => {
    if (!asset.dataUrl) {
      setImgWH(null)
      return
    }
    const img = new Image()
    let cancelled = false
    img.onload = () => {
      if (!cancelled) setImgWH({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = asset.dataUrl
    return () => {
      cancelled = true
      img.onload = null
    }
  }, [asset.dataUrl, asset.path])

  const grid = useMemo(
    () => (imgWH ? deriveGrid(imgWH.w, imgWH.h, cellW, cellH) : { cols: 0, rows: 0, totalFrames: 0 }),
    [imgWH, cellW, cellH],
  )

  const selectedKeys = useMemo(() => {
    const set = new Set<string>()
    for (const fr of activeClip?.frames ?? []) set.add(frameKey(fr))
    return set
  }, [activeClip])

  const rangeUi = useMemo(
    () => (activeClip ? frameRangeFromFrames(activeClip.frames, grid, cellW, cellH) : null),
    [activeClip, grid, cellW, cellH],
  )

  const updateClips = useCallback(
    (next: AnimationClipDef[]) => {
      onPatchClips(next.length > 0 ? next : [])
      setActiveClipIndex((idx) => (idx >= next.length ? Math.max(0, next.length - 1) : idx))
    },
    [onPatchClips],
  )

  const patchActiveClip = useCallback(
    (patch: Partial<AnimationClipDef>) => {
      if (!activeClip) return
      const next = [...clips]
      next[activeClipIndex] = { ...activeClip, ...patch }
      updateClips(next)
    },
    [activeClip, activeClipIndex, clips, updateClips],
  )

  const toggleCell = useCallback(
    (col: number, row: number) => {
      if (!activeClip || cellW <= 0 || cellH <= 0) return
      const fr = frameAtCell(col, row, cellW, cellH)
      const key = frameKey(fr)
      const frames = [...activeClip.frames]
      const idx = frames.findIndex((f) => frameKey(f) === key)
      if (idx >= 0) frames.splice(idx, 1)
      else frames.push(fr)
      const indices = framesToSortedIndices(frames, grid, cellW, cellH)
      patchActiveClip({ frames: indicesSetToFrames(indices, grid, cellW, cellH) })
    },
    [activeClip, cellW, cellH, patchActiveClip],
  )

  const setRange = useCallback(
    (start: number, end: number) => {
      const frames = indicesRangeToFrames(start, end, grid, cellW, cellH)
      if (frames.length === 0) return
      patchActiveClip({ frames })
    },
    [grid, cellW, cellH, patchActiveClip],
  )

  const addClip = useCallback(() => {
    updateClips([
      ...clips,
      { name: `clip_${clips.length + 1}`, frames: [], fps: 12, loop: true },
    ])
    setActiveClipIndex(clips.length)
  }, [clips, updateClips])

  const removeActiveClip = useCallback(() => {
    updateClips(clips.filter((_, i) => i !== activeClipIndex))
  }, [activeClipIndex, clips, updateClips])

  return {
    cellW,
    cellH,
    setCellW,
    setCellH,
    imgWH,
    grid,
    activeClipIndex,
    setActiveClipIndex,
    activeClip,
    clips,
    selectedKeys,
    rangeUi,
    toggleCell,
    setRange,
    patchActiveClip,
    updateClips,
    addClip,
    removeActiveClip,
  }
}
