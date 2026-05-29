import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AnimationClipDef, ImageAsset } from '../../types'
import {
  isBlobPreviewSrc,
  measureImageNaturalSize,
  resolveImagePreviewSrc,
  revokeImagePreviewSrc,
} from '../../utils/image-preview-src'
import {
  frameAtCell,
  frameKey,
  frameRangeFromFrames,
  framesToSortedIndices,
  indicesRangeToFrames,
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
  clips: AnimationClipDef[]
  selectedKeys: Set<string>
  rangeUi: FrameRangeUi | null
  toggleCell: (col: number, row: number) => void
  setRange: (start: number, end: number) => void
  setSelectionIndices: (indices: readonly number[], additive: boolean) => void
  selectAllFrames: () => void
  clearSelection: () => void
  patchActiveClip: (patch: Partial<AnimationClipDef>) => void
  updateClips: (next: AnimationClipDef[]) => void
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
  onPatchClips: (clips: AnimationClipDef[]) => void,
): SpritesheetStudioSession {
  const clips = asset.clips ?? []
  const [activeClipIndex, setActiveClipIndex] = useState(0)
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

  const activeClip = clips[activeClipIndex]

  useEffect(() => {
    const inferred = inferCell(asset.clips ?? [])
    setCellW(inferred.w)
    setCellH(inferred.h)
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
    const cols = inferGridCols(asset.clips ?? [], imgWH.w, c.w)
    const rows = Math.max(1, Math.floor(imgWH.h / Math.max(1, c.h)))
    setGridCols(cols)
    setGridRows(rows)
    setStripFrameCount(cols)
  }, [imgWH?.w, imgWH?.h, asset.path])

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
    const { remainderW, remainderH } = slicing.remainder
    if (remainderW === 0 && remainderH === 0) return null
    const parts: string[] = []
    if (remainderW > 0) parts.push(`${remainderW}px width unused`)
    if (remainderH > 0) parts.push(`${remainderH}px height unused`)
    return `Unused pixels: ${parts.join(', ')}.`
  }, [imgWH, slicing.remainder])

  const selectedKeys = useMemo(() => {
    const set = new Set<string>()
    for (const fr of activeClip?.frames ?? []) set.add(frameKey(fr))
    return set
  }, [activeClip])

  const rangeUi = useMemo(
    () =>
      activeClip
        ? frameRangeFromFrames(activeClip.frames, grid, effectiveCellW, effectiveCellH)
        : null,
    [activeClip, grid, effectiveCellW, effectiveCellH],
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

  const applyIndices = useCallback(
    (indices: readonly number[], additive: boolean) => {
      if (!activeClip) return
      const newFrames = indicesSetToFrames(
        additive
          ? mergeFrameIndices(
              framesToSortedIndices(activeClip.frames, grid, effectiveCellW, effectiveCellH),
              indices,
            )
          : indices,
        grid,
        effectiveCellW,
        effectiveCellH,
      )
      patchActiveClip({ frames: newFrames })
    },
    [activeClip, grid, effectiveCellW, effectiveCellH, patchActiveClip],
  )

  const toggleCell = useCallback(
    (col: number, row: number) => {
      if (!activeClip || effectiveCellW <= 0 || effectiveCellH <= 0) return
      const fr = frameAtCell(col, row, effectiveCellW, effectiveCellH)
      const key = frameKey(fr)
      const frames = [...activeClip.frames]
      const idx = frames.findIndex((f) => frameKey(f) === key)
      if (idx >= 0) frames.splice(idx, 1)
      else frames.push(fr)
      const indices = framesToSortedIndices(frames, grid, effectiveCellW, effectiveCellH)
      patchActiveClip({ frames: indicesSetToFrames(indices, grid, effectiveCellW, effectiveCellH) })
    },
    [activeClip, effectiveCellW, effectiveCellH, patchActiveClip, grid],
  )

  const setRange = useCallback(
    (start: number, end: number) => {
      const frames = indicesRangeToFrames(start, end, grid, effectiveCellW, effectiveCellH)
      if (frames.length === 0) return
      patchActiveClip({ frames })
    },
    [grid, effectiveCellW, effectiveCellH, patchActiveClip],
  )

  const setSelectionIndices = useCallback(
    (indices: readonly number[], additive: boolean) => {
      applyIndices(indices, additive)
    },
    [applyIndices],
  )

  const selectAllFrames = useCallback(() => {
    if (grid.totalFrames <= 0) return
    const all = Array.from({ length: grid.totalFrames }, (_, i) => i)
    applyIndices(all, false)
  }, [grid.totalFrames, applyIndices])

  const clearSelection = useCallback(() => {
    if (!activeClip) return
    patchActiveClip({ frames: [] })
  }, [activeClip, patchActiveClip])

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
    setActiveClipIndex,
    activeClip,
    clips,
    selectedKeys,
    rangeUi,
    toggleCell,
    setRange,
    setSelectionIndices,
    selectAllFrames,
    clearSelection,
    patchActiveClip,
    updateClips,
    addClip,
    removeActiveClip,
  }
}
