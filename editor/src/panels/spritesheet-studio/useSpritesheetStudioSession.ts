import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnimationClipDef, ImageAsset } from '../../types'
import {
  isBlobPreviewSrc,
  measureImageNaturalSize,
  resolveImagePreviewSrc,
  revokeImagePreviewSrc,
} from '../../utils/image-preview-src'
import { nextClipDraftName } from '../../utils/spritesheet-clip-draft'
import {
  cellIndex,
  clampFrameRange,
  frameKey,
  frameRangeFromFrames,
  framesToSortedIndices,
  guessStripSlicing,
  indicesSetToFrames,
  mergeFrameIndices,
  resolveSlicing,
  type FrameRangeUi,
  type GridRemainder,
  type SlicingMode,
  type SpritesheetGrid,
  type StripAxis,
} from '../../utils/spritesheet-studio'

export type SpritesheetStudioSession = Readonly<{
  previewSrc: string | null
  cellW: number
  cellH: number
  effectiveCellW: number
  effectiveCellH: number
  setCellW: (n: number) => void
  setCellH: (n: number) => void
  slicingMode: SlicingMode
  setSlicingMode: (m: SlicingMode) => void
  gridCols: number
  gridRows: number
  setGridCols: (n: number) => void
  setGridRows: (n: number) => void
  stripFrameCount: number
  setStripFrameCount: (n: number) => void
  stripAxis: StripAxis
  setStripAxis: (a: StripAxis) => void
  remainder: GridRemainder
  gridWarning: string | null
  imgWH: { w: number; h: number } | null
  grid: SpritesheetGrid
  activeClipIndex: number
  setActiveClipIndex: (i: number) => void
  activeClip: AnimationClipDef | undefined
  draftClip: AnimationClipDef | undefined
  previewClip: AnimationClipDef | undefined
  clips: AnimationClipDef[]
  selectedIndices: Set<number>
  rangeUi: FrameRangeUi | null
  toggleCell: (col: number, row: number) => void
  setRange: (start: number, end: number) => void
  setSelectionIndices: (indices: readonly number[], additive: boolean) => void
  selectAllFrames: () => void
  clearSelection: () => void
  patchActiveClip: (patch: Partial<AnimationClipDef>, coalesceKey?: string) => void
  patchDraft: (patch: Partial<AnimationClipDef>) => void
  startDraftFromSelection: () => void
  saveDraft: () => boolean
  cancelDraft: () => void
  updateClips: (next: AnimationClipDef[], coalesceKey?: string) => void
  addClip: () => void
  removeActiveClip: () => void
}>

function inferCell(clipsList: AnimationClipDef[]): { w: number; h: number } {
  for (const clip of clipsList) {
    const fr = clip.frames.find((f) => f.w > 0 && f.h > 0)
    if (fr) return { w: fr.w, h: fr.h }
  }
  return { w: 32, h: 32 }
}

function inferGridCols(_clipsList: AnimationClipDef[], imgW: number, cellW: number): number {
  if (cellW <= 0 || imgW <= 0) return 1
  return Math.max(1, Math.floor(imgW / cellW))
}

export function useSpritesheetStudioSession(
  asset: ImageAsset,
  projectPath: string | null,
  onPatchClips: (clips: AnimationClipDef[], coalesceKey?: string) => void,
): SpritesheetStudioSession {
  const clips = asset.clips ?? []
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [draftClip, setDraftClip] = useState<AnimationClipDef | undefined>()
  const initialCell = inferCell(asset.clips ?? [])

  const [cellW, setCellW] = useState(initialCell.w)
  const [cellH, setCellH] = useState(initialCell.h)
  const [slicingMode, setSlicingMode] = useState<SlicingMode>('cell')
  const [gridCols, setGridCols] = useState(4)
  const [gridRows, setGridRows] = useState(1)
  const [stripFrameCount, setStripFrameCount] = useState(4)
  const [stripAxis, setStripAxis] = useState<StripAxis>('horizontal')
  const [imgWH, setImgWH] = useState<{ w: number; h: number } | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(asset.dataUrl ?? null)
  const clipsNormalizedRef = useRef<string | null>(null)

  const activeClip = activeClipIndex >= 0 ? clips[activeClipIndex] : undefined
  const previewClip = draftClip ?? activeClip

  const selectActiveClip = useCallback((index: number) => {
    setDraftClip(undefined)
    setActiveClipIndex(index)
  }, [])

  useEffect(() => {
    const inferred = inferCell(asset.clips ?? [])
    setCellW(imgWH ? Math.min(inferred.w, imgWH.w) : inferred.w)
    setCellH(imgWH ? Math.min(inferred.h, imgWH.h) : inferred.h)
  }, [asset.path, imgWH?.w, imgWH?.h])

  useEffect(() => {
    clipsNormalizedRef.current = null
    setDraftClip(undefined)
    setActiveClipIndex(0)
  }, [asset.path])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const src = await resolveImagePreviewSrc(asset, projectPath)
      if (cancelled) {
        if (isBlobPreviewSrc(src)) revokeImagePreviewSrc(src)
        return
      }
      setPreviewSrc((prev) => {
        if (isBlobPreviewSrc(prev)) revokeImagePreviewSrc(prev)
        return src
      })
      if (!src) {
        setImgWH(null)
        return
      }
      const wh = await measureImageNaturalSize(src)
      if (!cancelled && wh) setImgWH(wh)
    })()

    return () => {
      cancelled = true
      setPreviewSrc((prev) => {
        if (isBlobPreviewSrc(prev)) revokeImagePreviewSrc(prev)
        return null
      })
      setImgWH(null)
    }
  }, [asset.id, asset.dataUrl, asset.path, projectPath])

  useEffect(() => {
    if (!imgWH) return
    const c = inferCell(asset.clips ?? [])
    const stripGuess = clips.length === 0 ? guessStripSlicing(imgWH.w, imgWH.h) : null
    if (stripGuess) {
      setSlicingMode('strip')
      setStripAxis(stripGuess.axis)
      setStripFrameCount(stripGuess.frameCount)
      setCellW(stripGuess.axis === 'horizontal' ? Math.floor(imgWH.w / stripGuess.frameCount) : imgWH.w)
      setCellH(stripGuess.axis === 'vertical' ? Math.floor(imgWH.h / stripGuess.frameCount) : imgWH.h)
      setGridCols(stripGuess.axis === 'horizontal' ? stripGuess.frameCount : 1)
      setGridRows(stripGuess.axis === 'vertical' ? stripGuess.frameCount : 1)
      return
    }
    if (clips.length === 0) setSlicingMode('cell')
    const cw = Math.min(c.w, imgWH.w)
    const ch = Math.min(c.h, imgWH.h)
    const cols = inferGridCols(asset.clips ?? [], imgWH.w, cw)
    const rows = Math.max(1, Math.floor(imgWH.h / Math.max(1, ch)))
    setGridCols(cols)
    setGridRows(rows)
    setStripFrameCount(cols)
  }, [imgWH?.w, imgWH?.h, asset.path, clips.length])

  const slicing = useMemo(() => {
    if (!imgWH) {
      return {
        cellW,
        cellH,
        grid: { cols: 0, rows: 0, totalFrames: 0 },
        remainder: { remainderW: 0, remainderH: 0 },
      }
    }
    return resolveSlicing(imgWH.w, imgWH.h, slicingMode, {
      cellW,
      cellH,
      gridCols,
      gridRows,
      stripFrameCount,
      stripAxis,
    })
  }, [imgWH, slicingMode, cellW, cellH, gridCols, gridRows, stripFrameCount, stripAxis])

  const effectiveCellW = slicing.cellW
  const effectiveCellH = slicing.cellH
  const grid = slicing.grid

  const gridWarning = useMemo(() => {
    if (!imgWH) return null
    const parts: string[] = []
    if (effectiveCellH > imgWH.h || effectiveCellW > imgWH.w) {
      parts.push(
        `Cell size exceeds the sheet (${imgWH.w}×${imgWH.h}px). Use height ${imgWH.h}px or Frame strip mode.`,
      )
    }
    const { remainderW, remainderH } = slicing.remainder
    if (remainderW > 0) parts.push(`${remainderW}px width unused`)
    if (remainderH > 0) parts.push(`${remainderH}px height unused`)
    return parts.length > 0 ? parts.join(' ') : null
  }, [imgWH, effectiveCellW, effectiveCellH, slicing.remainder])

  const sheet = imgWH

  useEffect(() => {
    if (!sheet || grid.totalFrames <= 0 || clips.length === 0) return
    const normKey = `${asset.path}:${sheet.w}x${sheet.h}:${effectiveCellW}x${effectiveCellH}`
    if (clipsNormalizedRef.current === normKey) return

    let changed = false
    const next = clips.map((clip) => {
      const indices = framesToSortedIndices(clip.frames, grid, effectiveCellW, effectiveCellH)
      const frames = indicesSetToFrames(indices, grid, effectiveCellW, effectiveCellH, sheet)
      if (
        frames.length === clip.frames.length &&
        frames.every((f, i) => frameKey(f) === frameKey(clip.frames[i]!))
      ) {
        return clip
      }
      changed = true
      return { ...clip, frames }
    })
    clipsNormalizedRef.current = normKey
    if (changed) onPatchClips(next)
  }, [
    asset.path,
    sheet,
    grid,
    effectiveCellW,
    effectiveCellH,
    clips,
    onPatchClips,
  ])

  const activeSelectedIndices = useMemo(
    () =>
      new Set(
        framesToSortedIndices(activeClip?.frames ?? [], grid, effectiveCellW, effectiveCellH),
      ),
    [activeClip, grid, effectiveCellW, effectiveCellH],
  )

  const draftSelectedIndices = useMemo(
    () =>
      new Set(
        framesToSortedIndices(draftClip?.frames ?? [], grid, effectiveCellW, effectiveCellH),
      ),
    [draftClip, grid, effectiveCellW, effectiveCellH],
  )

  const selectedIndices = draftClip ? draftSelectedIndices : activeSelectedIndices

  const rangeUi = useMemo(
    () =>
      activeClip
        ? frameRangeFromFrames(activeClip.frames, grid, effectiveCellW, effectiveCellH)
        : null,
    [activeClip, grid, effectiveCellW, effectiveCellH],
  )

  const updateClips = useCallback(
    (next: AnimationClipDef[], coalesceKey?: string) => {
      onPatchClips(next.length > 0 ? next : [], coalesceKey)
      setActiveClipIndex((idx) =>
        next.length === 0 ? -1 : idx >= next.length ? next.length - 1 : idx,
      )
    },
    [onPatchClips],
  )

  const patchActiveClip = useCallback(
    (patch: Partial<AnimationClipDef>, coalesceKey?: string) => {
      if (!activeClip) return
      const next = [...clips]
      next[activeClipIndex] = { ...activeClip, ...patch }
      updateClips(next, coalesceKey)
    },
    [activeClip, activeClipIndex, clips, updateClips],
  )

  const patchDraft = useCallback((patch: Partial<AnimationClipDef>) => {
    setDraftClip((draft) => draft ? { ...draft, ...patch } : draft)
  }, [])

  const startDraftFromSelection = useCallback(() => {
    setActiveClipIndex(-1)
    setDraftClip((draft) => draft ?? {
      name: nextClipDraftName(asset, clips),
      frames: [],
      fps: 12,
      loop: true,
    })
  }, [asset, clips])

  const cancelDraft = useCallback(() => {
    setDraftClip(undefined)
    setActiveClipIndex(clips.length > 0 ? 0 : -1)
  }, [clips.length])

  const saveDraft = useCallback(() => {
    const name = draftClip?.name.trim() ?? ''
    if (!draftClip || draftClip.frames.length === 0 || !name) return false
    if (clips.some((clip) => clip.name.trim() === name)) return false

    const saved = { ...draftClip, name, fps: Math.max(1, draftClip.fps || 12) }
    onPatchClips([...clips, saved])
    setActiveClipIndex(clips.length)
    setDraftClip(undefined)
    return true
  }, [clips, draftClip, onPatchClips])

  // Single conversion point: index space → persisted pixel frames.
  const commitIndices = useCallback(
    (indices: Iterable<number>) => {
      const frames = indicesSetToFrames([...indices], grid, effectiveCellW, effectiveCellH, sheet)
      if (activeClip && !draftClip) {
        patchActiveClip({ frames })
        return
      }
      setActiveClipIndex(-1)
      setDraftClip((draft) => ({
        name: draft?.name ?? nextClipDraftName(asset, clips),
        frames,
        fps: draft?.fps ?? 12,
        loop: draft?.loop ?? true,
      }))
    },
    [
      activeClip,
      asset,
      clips,
      draftClip,
      grid,
      effectiveCellW,
      effectiveCellH,
      sheet,
      patchActiveClip,
    ],
  )

  const setSelectionIndices = useCallback(
    (indices: readonly number[], additive: boolean) => {
      commitIndices(additive ? mergeFrameIndices([...selectedIndices], indices) : indices)
    },
    [selectedIndices, commitIndices],
  )

  const toggleCell = useCallback(
    (col: number, row: number) => {
      if (effectiveCellW <= 0 || effectiveCellH <= 0) return
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return
      const idx = cellIndex(col, row, grid.cols)
      const next = new Set(selectedIndices)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      commitIndices(next)
    },
    [effectiveCellW, effectiveCellH, grid.cols, grid.rows, selectedIndices, commitIndices],
  )

  const setRange = useCallback(
    (start: number, end: number) => {
      const clamped = clampFrameRange(start, end, grid.totalFrames)
      if (!clamped) return
      const indices: number[] = []
      for (let i = clamped.start; i <= clamped.end; i++) indices.push(i)
      commitIndices(indices)
    },
    [grid.totalFrames, commitIndices],
  )

  const selectAllFrames = useCallback(() => {
    if (grid.totalFrames <= 0) return
    commitIndices(Array.from({ length: grid.totalFrames }, (_, i) => i))
  }, [grid.totalFrames, commitIndices])

  const clearSelection = useCallback(() => {
    if (!activeClip && !draftClip) return
    commitIndices([])
  }, [activeClip, draftClip, commitIndices])

  const addClip = useCallback(() => {
    startDraftFromSelection()
  }, [startDraftFromSelection])

  const removeActiveClip = useCallback(() => {
    updateClips(clips.filter((_, i) => i !== activeClipIndex))
  }, [activeClipIndex, clips, updateClips])

  return {
    previewSrc,
    cellW,
    cellH,
    effectiveCellW,
    effectiveCellH,
    setCellW,
    setCellH,
    slicingMode,
    setSlicingMode,
    gridCols,
    gridRows,
    setGridCols,
    setGridRows,
    stripFrameCount,
    setStripFrameCount,
    stripAxis,
    setStripAxis,
    remainder: slicing.remainder,
    gridWarning,
    imgWH,
    grid,
    activeClipIndex,
    setActiveClipIndex: selectActiveClip,
    activeClip,
    draftClip,
    previewClip,
    clips,
    selectedIndices,
    rangeUi,
    toggleCell,
    setRange,
    setSelectionIndices,
    selectAllFrames,
    clearSelection,
    patchActiveClip,
    patchDraft,
    startDraftFromSelection,
    saveDraft,
    cancelDraft,
    updateClips,
    addClip,
    removeActiveClip,
  }
}
